import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Métricas de atendimento (WhatsApp/Instagram, via chats/mensagens
// sincronizados — ver src/lib/clint-sync.ts, resources "messages" e
// "channels"): tempo de resposta, leads nunca respondidos (com o texto da
// última mensagem), quebra por canal, canais desconectados, e contatos
// conversando em mais de um canal ao mesmo tempo. Protegido pelo prefixo
// /api/dashboard em src/proxy.ts (sessão master).
//
// Suporta os mesmos filtros de data/produto do resumo geral
// (?from=YYYY-MM-DD&to=YYYY-MM-DD&product=...), aplicados sobre o início da
// conversa (first_customer_message_at) e o produto do negócio mais recente
// do contato.

const UNANSWERED_LIMIT = 100;
const MULTI_CHANNEL_LIMIT = 100;

interface AtendimentoFilters {
  from: string | null;
  to: string | null;
  product: string | null;
}

function parseFilters(req: NextRequest): AtendimentoFilters {
  const sp = req.nextUrl.searchParams;
  return {
    from: sp.get("from") || null,
    to: sp.get("to") || null,
    product: sp.get("product") || null,
  };
}

function buildChatFilterClause(
  filters: AtendimentoFilters,
  startIndex: number
): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;
  if (filters.from) {
    conditions.push(`c.first_customer_message_at >= $${i++}`);
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`c.first_customer_message_at < ($${i++}::date + INTERVAL '1 day')`);
    params.push(filters.to);
  }
  if (filters.product) {
    conditions.push(
      `EXISTS (SELECT 1 FROM clint_deals dp WHERE dp.contact_id = c.contact_id AND COALESCE(dp.fields->>'product_name', dp.fields->>'produto') = $${i++})`
    );
    params.push(filters.product);
  }
  return { sql: conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "", params };
}

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req);
    const chatFilter = buildChatFilterClause(filters, 1);
    const limitIndex = chatFilter.params.length + 1;
    const filteredChatsCte = `
      WITH filtered_chats AS (
        SELECT c.* FROM clint_chats c
        ${chatFilter.sql}
      )
    `;

    const [
      overviewResult,
      byOriginResult,
      unansweredResult,
      channelsResult,
      byChannelResult,
      multiChannelResult,
    ] = await Promise.all([
      pool.query(
        `
        ${filteredChatsCte}
        SELECT
          (SELECT COUNT(*) FROM filtered_chats) AS total_chats,
          (SELECT COUNT(*) FROM clint_messages m JOIN filtered_chats fc ON fc.id = m.chat_id) AS total_messages,
          (SELECT COUNT(*) FROM filtered_chats WHERE first_customer_message_at IS NOT NULL) AS total_com_contato,
          (SELECT COUNT(*) FROM filtered_chats WHERE first_customer_message_at IS NOT NULL AND first_response_at IS NULL) AS nunca_respondido,
          (SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - first_customer_message_at)) / 60)
             FROM filtered_chats
             WHERE first_response_at IS NOT NULL AND first_customer_message_at IS NOT NULL) AS avg_response_minutes
        `,
        chatFilter.params
      ),
      pool.query(
        `
        ${filteredChatsCte}
        SELECT
          COALESCE(orig.name, 'Sem origem') AS origin_name,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE c.first_customer_message_at IS NOT NULL AND c.first_response_at IS NULL) AS nunca_respondido,
          AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.first_customer_message_at)) / 60)
            FILTER (WHERE c.first_response_at IS NOT NULL AND c.first_customer_message_at IS NOT NULL) AS avg_response_minutes
        FROM filtered_chats c
        LEFT JOIN LATERAL (
          SELECT origin_id FROM clint_deals dd WHERE dd.contact_id = c.contact_id ORDER BY clint_created_at DESC LIMIT 1
        ) d ON true
        LEFT JOIN clint_origins orig ON orig.id = d.origin_id
        WHERE c.first_customer_message_at IS NOT NULL
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 15
        `,
        chatFilter.params
      ),
      pool.query(
        `
        ${filteredChatsCte},
        unanswered AS (
          SELECT c.id AS chat_id, c.contact_id, c.channel_account_id, c.first_customer_message_at, c.last_message_at, c.status
          FROM filtered_chats c
          WHERE c.first_customer_message_at IS NOT NULL AND c.first_response_at IS NULL
          ORDER BY c.last_message_at DESC NULLS LAST
          LIMIT $${limitIndex}
        )
        SELECT
          u.chat_id,
          u.contact_id,
          co.name AS contact_name,
          co.full_phone,
          u.first_customer_message_at,
          u.last_message_at,
          u.status,
          d.stage,
          d.value,
          orig.name AS origin_name,
          ch.name AS channel_name,
          ch.type AS channel_type,
          lm.content AS last_message_content
        FROM unanswered u
        LEFT JOIN clint_contacts co ON co.id = u.contact_id
        LEFT JOIN clint_channel_accounts ch ON ch.id = u.channel_account_id
        LEFT JOIN LATERAL (
          SELECT stage, value, origin_id FROM clint_deals dd WHERE dd.contact_id = u.contact_id ORDER BY clint_created_at DESC LIMIT 1
        ) d ON true
        LEFT JOIN clint_origins orig ON orig.id = d.origin_id
        LEFT JOIN LATERAL (
          SELECT content FROM clint_messages m WHERE m.chat_id = u.chat_id ORDER BY clint_created_at DESC LIMIT 1
        ) lm ON true
        ORDER BY u.last_message_at DESC NULLS LAST
        `,
        [...chatFilter.params, UNANSWERED_LIMIT]
      ),
      pool.query(`SELECT id, name, type, status, identifier FROM clint_channel_accounts ORDER BY name`),
      pool.query(
        `
        ${filteredChatsCte}
        SELECT
          COALESCE(ch.name, 'Canal desconhecido') AS channel_name,
          COALESCE(ch.type, '—') AS channel_type,
          ch.status AS channel_status,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE c.first_customer_message_at IS NOT NULL AND c.first_response_at IS NULL) AS nunca_respondido,
          AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.first_customer_message_at)) / 60)
            FILTER (WHERE c.first_response_at IS NOT NULL AND c.first_customer_message_at IS NOT NULL) AS avg_response_minutes
        FROM filtered_chats c
        LEFT JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        WHERE c.first_customer_message_at IS NOT NULL
        GROUP BY 1, 2, 3
        ORDER BY total DESC
        `,
        chatFilter.params
      ),
      pool.query(
        `
        ${filteredChatsCte},
        per_contact AS (
          SELECT contact_id, COUNT(DISTINCT channel_account_id) AS canais, MAX(last_message_at) AS ultima_atividade
          FROM filtered_chats
          WHERE contact_id IS NOT NULL AND channel_account_id IS NOT NULL
          GROUP BY contact_id
          HAVING COUNT(DISTINCT channel_account_id) > 1
        )
        SELECT
          pc.contact_id,
          co.name AS contact_name,
          pc.canais,
          pc.ultima_atividade,
          ARRAY_AGG(DISTINCT ch.name) AS nomes_canais
        FROM per_contact pc
        LEFT JOIN clint_contacts co ON co.id = pc.contact_id
        LEFT JOIN filtered_chats c ON c.contact_id = pc.contact_id
        LEFT JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        GROUP BY pc.contact_id, co.name, pc.canais, pc.ultima_atividade
        ORDER BY pc.ultima_atividade DESC NULLS LAST
        LIMIT $${limitIndex}
        `,
        [...chatFilter.params, MULTI_CHANNEL_LIMIT]
      ),
    ]);

    const overview = overviewResult.rows[0];
    const totalComContato = Number(overview.total_com_contato);
    const nuncaRespondido = Number(overview.nunca_respondido);

    return NextResponse.json({
      overview: {
        totalChats: Number(overview.total_chats),
        totalMessages: Number(overview.total_messages),
        totalComContato,
        nuncaRespondido,
        pctNuncaRespondido: totalComContato > 0 ? nuncaRespondido / totalComContato : null,
        avgResponseMinutes: overview.avg_response_minutes ? Number(overview.avg_response_minutes) : null,
      },
      channels: channelsResult.rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        status: r.status,
        identifier: r.identifier,
      })),
      byChannel: byChannelResult.rows.map((r) => ({
        channelName: r.channel_name,
        channelType: r.channel_type,
        channelStatus: r.channel_status,
        total: Number(r.total),
        nuncaRespondido: Number(r.nunca_respondido),
        avgResponseMinutes: r.avg_response_minutes ? Number(r.avg_response_minutes) : null,
      })),
      byOrigin: byOriginResult.rows.map((r) => ({
        originName: r.origin_name,
        total: Number(r.total),
        nuncaRespondido: Number(r.nunca_respondido),
        avgResponseMinutes: r.avg_response_minutes ? Number(r.avg_response_minutes) : null,
      })),
      unanswered: unansweredResult.rows.map((r) => ({
        chatId: r.chat_id,
        contactId: r.contact_id,
        contactName: r.contact_name || "(sem nome)",
        phone: r.full_phone,
        firstCustomerMessageAt: r.first_customer_message_at,
        lastMessageAt: r.last_message_at,
        status: r.status,
        stage: r.stage,
        value: r.value !== null ? Number(r.value) : null,
        originName: r.origin_name,
        channelName: r.channel_name,
        channelType: r.channel_type,
        lastMessageContent: r.last_message_content,
      })),
      multiChannelContacts: multiChannelResult.rows.map((r) => ({
        contactId: r.contact_id,
        contactName: r.contact_name || "(sem nome)",
        channelCount: Number(r.canais),
        channelNames: (r.nomes_canais as (string | null)[]).filter(Boolean),
        lastActivityAt: r.ultima_atividade,
      })),
    });
  } catch (error) {
    console.error("Erro ao agregar dados de atendimento da Clint:", error);
    return NextResponse.json({ error: "Erro ao carregar dados de atendimento." }, { status: 500 });
  }
}
