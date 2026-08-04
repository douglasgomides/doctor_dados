import pool from "@/lib/db";
import {
  fetchContactsPage,
  fetchDealsPage,
  fetchOriginsPage,
  fetchTagsPage,
  fetchChatsForContact,
  fetchMessagesForChat,
  fetchChannelAccounts,
  ClintContact,
  ClintDeal,
  ClintChat,
  ClintMessage,
} from "@/lib/clint";

export type ClintResource =
  | "contacts"
  | "deals"
  | "origins"
  | "tags"
  | "messages"
  | "messages_nodeal"
  | "channels";

// Não existe endpoint da Clint pra listar chats/mensagens em massa — só por
// contato/chat individualmente. Sincronizar os 61k+ contatos seria
// inviável (cada um custa 1+ chamadas), então limitamos aos contatos com
// pelo menos um negócio associado (relevantes comercialmente), priorizando
// os com atividade mais recente. Se precisar de mais cobertura depois, dá
// pra aumentar esse valor e rodar a sincronização de novo.
const MESSAGES_SYNC_CONTACT_LIMIT = 1500;

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

async function upsertChats(chats: ClintChat[]): Promise<void> {
  const columns = [
    "id",
    "contact_id",
    "user_id",
    "status",
    "replied",
    "seen",
    "unread",
    "unseen_count",
    "channel_account_id",
    "first_customer_message_at",
    "first_response_at",
    "last_message_at",
    "last_response_at",
    "closed_at",
    "clint_created_at",
    "synced_at",
  ];
  const now = new Date().toISOString();
  const rows = chats.map((c) => [
    c.id,
    c.contact_id,
    c.user_id,
    c.status,
    c.replied,
    c.seen,
    c.unread,
    c.unseen_count,
    c.channel_account_id,
    c.first_customer_message_at,
    c.first_response_at,
    c.last_message_at,
    c.last_response_at,
    c.closed_at,
    c.created_at,
    now,
  ]);
  await bulkUpsert("clint_chats", columns, rows, "id");
}

async function upsertMessages(messages: ClintMessage[]): Promise<void> {
  const columns = [
    "id",
    "chat_id",
    "user_id",
    "content",
    "type",
    "content_type",
    "status",
    "clint_created_at",
    "synced_at",
  ];
  const now = new Date().toISOString();
  const rows = messages.map((m) => [
    m.id,
    m.chat_id,
    m.user_id,
    m.content,
    m.type,
    m.content_type,
    m.status,
    m.created_at,
    now,
  ]);
  await bulkUpsert("clint_messages", columns, rows, "id");
}

/**
 * Busca todas as páginas de chats de um contato (a Clint pagina em blocos
 * de até 200) — sem isso, contatos com mais de 200 chats ficavam truncados.
 */
async function fetchAllChatsForContact(contactId: string, deadline: number): Promise<ClintChat[]> {
  const chats: ClintChat[] = [];
  let page = 1;
  for (;;) {
    const response = await fetchChatsForContact(contactId, page, 200);
    chats.push(...response.data);
    if (!response.has_next || Date.now() >= deadline) break;
    page += 1;
  }
  return chats;
}

/** Idem, para todas as páginas de mensagens de um chat. */
async function fetchAllMessagesForChat(chatId: string, deadline: number): Promise<ClintMessage[]> {
  const messages: ClintMessage[] = [];
  let page = 1;
  for (;;) {
    const response = await fetchMessagesForChat(chatId, page, 200);
    messages.push(...response.data);
    if (!response.has_next || Date.now() >= deadline) break;
    page += 1;
  }
  return messages;
}

/**
 * Sincroniza chats + mensagens dos contatos com negócio associado (ver
 * MESSAGES_SYNC_CONTACT_LIMIT), de forma retomável: busca um lote de IDs de
 * contato a partir do offset salvo, processa um por um (todas as páginas de
 * chats + todas as páginas de mensagens de cada chat) até esgotar o
 * orçamento de tempo, e grava quantos processou. A próxima chamada continua
 * do offset seguinte.
 */
async function syncMessages(timeBudgetMs: number): Promise<ClintSyncResult> {
  const state = await getSyncState("messages");
  const deadline = Date.now() + timeBudgetMs;
  const startOffset = state.next_page || 1;

  try {
    const totalResult = await pool.query(
      `SELECT COUNT(DISTINCT contact_id) AS total FROM clint_deals WHERE contact_id IS NOT NULL`
    );
    const totalContacts = Math.min(MESSAGES_SYNC_CONTACT_LIMIT, Number(totalResult.rows[0].total));

    const batchResult = await pool.query(
      `
      SELECT contact_id
      FROM clint_deals
      WHERE contact_id IS NOT NULL
      GROUP BY contact_id
      ORDER BY MAX(clint_updated_at) DESC NULLS LAST
      LIMIT 300 OFFSET $1
      `,
      [startOffset - 1]
    );
    const contactIds: string[] = batchResult.rows.map((r) => r.contact_id);

    let processed = 0;
    let recordsSynced = 0;

    for (const contactId of contactIds) {
      if (Date.now() >= deadline) break;

      const chats = await fetchAllChatsForContact(contactId, deadline);
      if (chats.length > 0) {
        await upsertChats(chats);
        for (const chat of chats) {
          if (Date.now() >= deadline) break;
          const messages = await fetchAllMessagesForChat(chat.id, deadline);
          if (messages.length > 0) {
            await upsertMessages(messages);
            recordsSynced += messages.length;
          }
        }
      }
      processed += 1;
    }

    const newOffset = startOffset + processed;
    const done = newOffset > totalContacts;

    await updateSyncState("messages", {
      nextPage: done ? 1 : newOffset,
      totalPages: totalContacts,
      recordsSyncedLastRun: recordsSynced,
      status: done ? "idle" : "in_progress",
      lastError: null,
      completed: done,
    });

    return {
      resource: "messages",
      pagesSynced: processed,
      recordsSynced,
      done,
      currentPage: newOffset,
      totalPages: totalContacts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSyncState("messages", { status: "error", lastError: message });
    throw error;
  }
}

/**
 * Sincroniza chats + mensagens dos contatos SEM negócio associado, mas com
 * "assinatura" de lead só-Instagram (username preenchido, sem telefone) —
 * ex: quem comentou/mandou DM via ManyChat mas nunca virou negócio no
 * funil. A sincronização "messages" (acima) só olha contatos COM negócio,
 * então esse universo inteiro (54k+ contatos, 0% cobertos) ficava de fora
 * por completo, não por causa do tamanho da janela. Mesmo padrão retomável,
 * fila separada (resource "messages_nodeal") pra não interferir na outra.
 */
async function syncMessagesNoDeal(timeBudgetMs: number): Promise<ClintSyncResult> {
  const state = await getSyncState("messages_nodeal");
  const deadline = Date.now() + timeBudgetMs;
  const startOffset = state.next_page || 1;

  const CONTACT_FILTER = `
    c.username IS NOT NULL AND c.full_phone IS NULL
    AND NOT EXISTS (SELECT 1 FROM clint_deals d WHERE d.contact_id = c.id)
  `;

  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total FROM clint_contacts c WHERE ${CONTACT_FILTER}`
    );
    const totalContacts = Number(totalResult.rows[0].total);

    const batchResult = await pool.query(
      `
      SELECT c.id AS contact_id
      FROM clint_contacts c
      WHERE ${CONTACT_FILTER}
      ORDER BY c.id
      LIMIT 300 OFFSET $1
      `,
      [startOffset - 1]
    );
    const contactIds: string[] = batchResult.rows.map((r) => r.contact_id);

    let processed = 0;
    let recordsSynced = 0;

    for (const contactId of contactIds) {
      if (Date.now() >= deadline) break;

      const chats = await fetchAllChatsForContact(contactId, deadline);
      if (chats.length > 0) {
        await upsertChats(chats);
        for (const chat of chats) {
          if (Date.now() >= deadline) break;
          const messages = await fetchAllMessagesForChat(chat.id, deadline);
          if (messages.length > 0) {
            await upsertMessages(messages);
            recordsSynced += messages.length;
          }
        }
      }
      processed += 1;
    }

    const newOffset = startOffset + processed;
    const done = newOffset > totalContacts;

    await updateSyncState("messages_nodeal", {
      nextPage: done ? 1 : newOffset,
      totalPages: totalContacts,
      recordsSyncedLastRun: recordsSynced,
      status: done ? "idle" : "in_progress",
      lastError: null,
      completed: done,
    });

    return {
      resource: "messages_nodeal",
      pagesSynced: processed,
      recordsSynced,
      done,
      currentPage: newOffset,
      totalPages: totalContacts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSyncState("messages_nodeal", { status: "error", lastError: message });
    throw error;
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

/** Só 3 registros hoje — busca tudo e upserta numa chamada só. */
async function syncChannelAccounts(): Promise<ClintSyncResult> {
  try {
    const response = await fetchChannelAccounts();
    if (response.data.length > 0) {
      const now = new Date().toISOString();
      const rows = response.data.map((c) => [c.id, c.name, c.type, c.status, c.identifier, now]);
      await bulkUpsert(
        "clint_channel_accounts",
        ["id", "name", "type", "status", "identifier", "synced_at"],
        rows,
        "id"
      );
    }

    await updateSyncState("channels", {
      nextPage: 1,
      totalPages: 1,
      totalCount: response.data.length,
      recordsSyncedLastRun: response.data.length,
      status: "idle",
      lastError: null,
      completed: true,
    });

    return {
      resource: "channels",
      pagesSynced: 1,
      recordsSynced: response.data.length,
      done: true,
      currentPage: 1,
      totalPages: 1,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateSyncState("channels", { status: "error", lastError: message });
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
  if (resource === "messages") {
    return syncMessages(timeBudgetMs);
  }
  if (resource === "messages_nodeal") {
    return syncMessagesNoDeal(timeBudgetMs);
  }
  if (resource === "channels") {
    return syncChannelAccounts();
  }
  return syncFullResource(resource);
}
