import pool from "@/lib/db";
import { fetchContactsPage, fetchEmailCampaignsPage, BrevoContact, BrevoCampaign } from "@/lib/brevo";

export type BrevoResource = "brevo_contacts" | "brevo_campaigns";

export interface BrevoSyncResult {
  resource: BrevoResource;
  recordsSynced: number;
  done: boolean;
  currentOffset: number;
  totalCount: number | null;
}

const DEFAULT_TIME_BUDGET_MS = 45_000;
const CONTACTS_PAGE_SIZE = 500;
const CAMPAIGNS_PAGE_SIZE = 50;

interface SyncStateRow {
  resource: string;
  next_page: number;
  total_pages: number | null;
}

async function getSyncState(resource: BrevoResource): Promise<SyncStateRow> {
  const result = await pool.query(`SELECT * FROM brevo_sync_state WHERE resource = $1`, [resource]);
  if (result.rows.length === 0) {
    await pool.query(`INSERT INTO brevo_sync_state (resource, next_page, status) VALUES ($1, 1, 'idle')`, [
      resource,
    ]);
    return { resource, next_page: 1, total_pages: null };
  }
  return result.rows[0];
}

async function updateSyncState(
  resource: BrevoResource,
  patch: Partial<{
    nextPage: number;
    totalCount: number;
    recordsSyncedLastRun: number;
    status: string;
    lastError: string | null;
    completed: boolean;
  }>
): Promise<void> {
  const sets: string[] = [`last_run_at = NOW()`];
  const values: unknown[] = [];
  let i = 1;

  if (patch.nextPage !== undefined) {
    sets.push(`next_page = $${i++}`);
    values.push(patch.nextPage);
  }
  if (patch.totalCount !== undefined) {
    sets.push(`total_count = $${i++}`);
    values.push(patch.totalCount);
  }
  if (patch.recordsSyncedLastRun !== undefined) {
    sets.push(`records_synced_last_run = $${i++}`);
    values.push(patch.recordsSyncedLastRun);
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${i++}`);
    values.push(patch.status);
  }
  if (patch.lastError !== undefined) {
    sets.push(`last_error = $${i++}`);
    values.push(patch.lastError);
  }
  if (patch.completed) {
    sets.push(`last_completed_at = NOW()`);
  }

  values.push(resource);
  await pool.query(`UPDATE brevo_sync_state SET ${sets.join(", ")} WHERE resource = $${i}`, values);
}

/**
 * Monta e executa um INSERT ... ON CONFLICT (col) DO UPDATE em lote.
 * `columns`/`table`/`conflictColumn` são sempre valores fixos definidos no
 * código (nunca vindos de input externo), então a interpolação direta na
 * string SQL aqui é segura — só os valores das linhas vão como parâmetros.
 */
async function bulkUpsert(
  table: string,
  columns: string[],
  rows: unknown[][],
  conflictColumn: string
): Promise<void> {
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const valuePlaceholders = rows.map((row, rowIndex) => {
    const placeholders = row.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
    values.push(...row);
    return `(${placeholders.join(", ")})`;
  });

  const updateSet = columns
    .filter((c) => c !== conflictColumn)
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(", ");

  await pool.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${valuePlaceholders.join(", ")} ` +
      `ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updateSet}`,
    values
  );
}

async function upsertContacts(contacts: BrevoContact[]): Promise<void> {
  const columns = [
    "id",
    "email",
    "attributes",
    "list_ids",
    "email_blacklisted",
    "sms_blacklisted",
    "whatsapp_blacklisted",
    "brevo_created_at",
    "brevo_modified_at",
    "synced_at",
  ];
  const now = new Date().toISOString();
  const rows = contacts.map((c) => [
    c.id,
    c.email ?? null,
    JSON.stringify(c.attributes ?? {}),
    c.listIds ?? [],
    c.emailBlacklisted,
    c.smsBlacklisted,
    c.whatsappBlacklisted ?? false,
    c.createdAt,
    c.modifiedAt,
    now,
  ]);
  await bulkUpsert("brevo_contacts", columns, rows, "id");
}

async function upsertCampaigns(campaigns: BrevoCampaign[]): Promise<void> {
  const columns = [
    "id",
    "name",
    "subject",
    "type",
    "status",
    "sent_date",
    "stats",
    "brevo_created_at",
    "brevo_modified_at",
    "synced_at",
  ];
  const now = new Date().toISOString();
  const rows = campaigns.map((c) => [
    c.id,
    c.name,
    c.subject ?? null,
    c.type,
    c.status,
    c.sentDate ?? null,
    JSON.stringify(c.statistics?.globalStats ?? {}),
    c.createdAt,
    c.modifiedAt,
    now,
  ]);
  await bulkUpsert("brevo_campaigns", columns, rows, "id");
}

/**
 * Sincroniza contatos ou campanhas da Brevo de forma retomável (paginação
 * por offset, diferente da Clint que pagina por número de página): busca um
 * lote a partir do offset salvo, processa até esgotar o orçamento de tempo,
 * e grava até onde chegou em brevo_sync_state. A próxima chamada continua
 * do offset seguinte.
 */
async function syncPaginatedResource(
  resource: BrevoResource,
  timeBudgetMs: number
): Promise<BrevoSyncResult> {
  const state = await getSyncState(resource);
  const deadline = Date.now() + timeBudgetMs;
  const pageSize = resource === "brevo_contacts" ? CONTACTS_PAGE_SIZE : CAMPAIGNS_PAGE_SIZE;
  let offset = state.next_page - 1;
  let recordsSynced = 0;
  let totalCount: number | null = null;

  try {
    for (;;) {
      if (Date.now() >= deadline) {
        await updateSyncState(resource, {
          nextPage: offset + 1,
          totalCount: totalCount ?? undefined,
          recordsSyncedLastRun: recordsSynced,
          status: "in_progress",
          lastError: null,
        });
        return { resource, recordsSynced, done: false, currentOffset: offset, totalCount };
      }

      let pageLength: number;

      if (resource === "brevo_contacts") {
        const page = await fetchContactsPage(offset, pageSize);
        totalCount = page.count;
        pageLength = page.contacts.length;
        if (pageLength > 0) {
          await upsertContacts(page.contacts);
          recordsSynced += pageLength;
        }
      } else {
        const page = await fetchEmailCampaignsPage(offset, pageSize);
        totalCount = page.count;
        pageLength = page.campaigns.length;
        if (pageLength > 0) {
          await upsertCampaigns(page.campaigns);
          recordsSynced += pageLength;
        }
      }

      offset += pageLength;

      if (pageLength < pageSize || offset >= totalCount) {
        await updateSyncState(resource, {
          nextPage: 1,
          totalCount,
          recordsSyncedLastRun: recordsSynced,
          status: "idle",
          lastError: null,
          completed: true,
        });
        return { resource, recordsSynced, done: true, currentOffset: offset, totalCount };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSyncState(resource, { status: "error", lastError: message });
    throw error;
  }
}

export async function syncBrevoResource(
  resource: BrevoResource,
  timeBudgetMs: number = DEFAULT_TIME_BUDGET_MS
): Promise<BrevoSyncResult> {
  return syncPaginatedResource(resource, timeBudgetMs);
}
