import pool from "@/lib/db";
import {
  fetchContactsPage,
  fetchDealsPage,
  fetchOriginsPage,
  fetchTagsPage,
  ClintContact,
  ClintDeal,
} from "@/lib/clint";

export type ClintResource = "contacts" | "deals" | "origins" | "tags";

export interface ClintSyncResult {
  resource: ClintResource;
  pagesSynced: number;
  recordsSynced: number;
  done: boolean;
  currentPage: number;
  totalPages: number | null;
}

const DEFAULT_TIME_BUDGET_MS = 45_000;

interface SyncStateRow {
  resource: string;
  next_page: number;
  total_pages: number | null;
}

async function getSyncState(resource: ClintResource): Promise<SyncStateRow> {
  const result = await pool.query(`SELECT * FROM clint_sync_state WHERE resource = $1`, [resource]);
  if (result.rows.length === 0) {
    await pool.query(`INSERT INTO clint_sync_state (resource, next_page, status) VALUES ($1, 1, 'idle')`, [
      resource,
    ]);
    return { resource, next_page: 1, total_pages: null };
  }
  return result.rows[0];
}

async function updateSyncState(
  resource: ClintResource,
  patch: Partial<{
    nextPage: number;
    totalPages: number;
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
  if (patch.totalPages !== undefined) {
    sets.push(`total_pages = $${i++}`);
    values.push(patch.totalPages);
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
  await pool.query(`UPDATE clint_sync_state SET ${sets.join(", ")} WHERE resource = $${i}`, values);
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

async function upsertContacts(contacts: ClintContact[]): Promise<void> {
  const columns = [
    "id",
    "name",
    "email",
    "ddi",
    "phone",
    "username",
    "full_phone",
    "organization_id",
    "tags",
    "fields",
    "clint_created_at",
    "clint_updated_at",
    "synced_at",
  ];
  const now = new Date().toISOString();
  const rows = contacts.map((c) => [
    c.id,
    c.name,
    c.email,
    c.ddi,
    c.phone,
    c.username,
    c.fullPhone,
    c.organization?.id ?? null,
    JSON.stringify(c.tags ?? []),
    JSON.stringify(c.fields ?? {}),
    c.created_at,
    c.updated_at,
    now,
  ]);
  await bulkUpsert("clint_contacts", columns, rows, "id");
}

async function upsertDeals(deals: ClintDeal[]): Promise<void> {
  const columns = [
    "id",
    "origin_id",
    "user_id",
    "user_name",
    "user_email",
    "contact_id",
    "contact_name",
    "status",
    "stage",
    "stage_id",
    "value",
    "currency",
    "won_at",
    "lost_at",
    "lost_status_id",
    "fields",
    "clint_created_at",
    "clint_updated_at",
    "clint_updated_stage_at",
    "synced_at",
  ];
  const now = new Date().toISOString();
  const rows = deals.map((d) => [
    d.id,
    d.origin_id,
    d.user?.id ?? null,
    d.user?.full_name ?? null,
    d.user?.email ?? null,
    d.contact?.id ?? null,
    d.contact?.name ?? null,
    d.status,
    d.stage,
    d.stage_id,
    d.value,
    d.currency,
    d.won_at,
    d.lost_at,
    d.lost_status_id,
    JSON.stringify(d.fields ?? {}),
    d.created_at,
    d.updated_at,
    d.updated_stage_at,
    now,
  ]);
  await bulkUpsert("clint_deals", columns, rows, "id");

  // Não existe endpoint da Clint que liste as etapas do funil — só aparecem
  // embutidas em cada negócio. Aproveitamos a sincronização de negócios pra
  // manter essa tabela de referência atualizada.
  const stageMap = new Map<string, string>();
  for (const d of deals) {
    if (d.stage_id) stageMap.set(d.stage_id, d.stage);
  }
  if (stageMap.size > 0) {
    const stageRows = Array.from(stageMap.entries()).map(([id, name]) => [id, name, now]);
    await bulkUpsert("clint_stages", ["id", "name", "synced_at"], stageRows, "id");
  }
}

/**
 * Sincroniza contatos ou negócios de forma retomável: processa páginas até
 * esgotar `timeBudgetMs` (pensado pro limite de execução de uma função
 * serverless) e grava até onde chegou em clint_sync_state. A próxima
 * chamada continua da página onde parou.
 */
async function syncPaginatedResource(
  resource: "contacts" | "deals",
  timeBudgetMs: number
): Promise<ClintSyncResult> {
  const state = await getSyncState(resource);
  const deadline = Date.now() + timeBudgetMs;
  let page = state.next_page || 1;
  let pagesSynced = 0;
  let recordsSynced = 0;
  let totalPages = state.total_pages;

  try {
    while (Date.now() < deadline) {
      const response =
        resource === "contacts" ? await fetchContactsPage(page) : await fetchDealsPage(page);
      totalPages = response.totalPages;

      if (response.data.length > 0) {
        if (resource === "contacts") {
          await upsertContacts(response.data as ClintContact[]);
        } else {
          await upsertDeals(response.data as ClintDeal[]);
        }
        recordsSynced += response.data.length;
      }
      pagesSynced += 1;

      if (!response.hasNext) {
        await updateSyncState(resource, {
          nextPage: 1,
          totalPages: totalPages ?? undefined,
          totalCount: response.totalCount,
          recordsSyncedLastRun: recordsSynced,
          status: "idle",
          lastError: null,
          completed: true,
        });
        return { resource, pagesSynced, recordsSynced, done: true, currentPage: page, totalPages };
      }

      page += 1;
    }

    await updateSyncState(resource, {
      nextPage: page,
      totalPages: totalPages ?? undefined,
      recordsSyncedLastRun: recordsSynced,
      status: "in_progress",
      lastError: null,
    });
    return { resource, pagesSynced, recordsSynced, done: false, currentPage: page, totalPages };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSyncState(resource, { status: "error", lastError: message });
    throw error;
  }
}

/** Origens e tags são pequenas (dezenas de registros) — sincronizadas por inteiro a cada chamada. */
async function syncFullResource(resource: "origins" | "tags"): Promise<ClintSyncResult> {
  let page = 1;
  let pagesSynced = 0;
  let recordsSynced = 0;
  let totalPages = 1;

  try {
    for (;;) {
      const now = new Date().toISOString();
      let hasNext: boolean;
      let recordCount: number;

      if (resource === "origins") {
        const response = await fetchOriginsPage(page);
        totalPages = response.totalPages;
        hasNext = response.hasNext;
        recordCount = response.data.length;
        if (recordCount > 0) {
          const rows = response.data.map((o) => [o.id, o.name, now]);
          await bulkUpsert("clint_origins", ["id", "name", "synced_at"], rows, "id");
        }
      } else {
        const response = await fetchTagsPage(page);
        totalPages = response.totalPages;
        hasNext = response.hasNext;
        recordCount = response.data.length;
        if (recordCount > 0) {
          const rows = response.data.map((t) => [t.id, t.name, t.color, now]);
          await bulkUpsert("clint_tags", ["id", "name", "color", "synced_at"], rows, "id");
        }
      }

      recordsSynced += recordCount;
      pagesSynced += 1;

      if (!hasNext) break;
      page += 1;
    }

    await updateSyncState(resource, {
      nextPage: 1,
      totalPages,
      recordsSyncedLastRun: recordsSynced,
      status: "idle",
      lastError: null,
      completed: true,
    });
    return { resource, pagesSynced, recordsSynced, done: true, currentPage: page, totalPages };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSyncState(resource, { status: "error", lastError: message });
    throw error;
  }
}

export async function syncResource(
  resource: ClintResource,
  timeBudgetMs: number = DEFAULT_TIME_BUDGET_MS
): Promise<ClintSyncResult> {
  if (resource === "contacts" || resource === "deals") {
    return syncPaginatedResource(resource, timeBudgetMs);
  }
  return syncFullResource(resource);
}
