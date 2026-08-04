import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Métricas de atendimento (WhatsApp/Instagram, via chats/mensagens
// sincronizados — ver src/lib/clint-sync.ts, resources "messages",
// "messages_nodeal" e "channels"): tempo de resposta, leads nunca
// respondidos (com o texto da última mensagem), quebra por canal, canais
// desconectados, e contatos conversando em mais de um canal ao mesmo tempo.
// Protegido pelo prefixo /api/dashboard em src/proxy.ts (sessão master).
//
// IMPORTANTE — três categorias bem diferentes, tratadas separadamente:
//
// 1. Comentários de Instagram (content_type = 'COMMENT') — engajamento em
//    post, não é conversa. Aparecem à parte em `comments`.
// 2. Infoproduto/automação — chats onde o cliente mandou mensagem e só
//    recebeu resposta de bot/automação (ManyChat), NUNCA de uma pessoa do
//    time (mensagem com user_id preenchido). É o funil de entrega
//    automática funcionando como projetado, não uma falha de atendimento.
// 3. Atendimento humano — chats onde uma pessoa do time (user_id
//    preenchido numa mensagem não-CUSTOMER) participou em algum momento.
//    Tempo de resposta e "nunca respondido" são calculados só aqui, com
//    base na PRIMEIRA resposta humana (não a primeira resposta de
//    qualquer tipo) — senão uma resposta automática instantânea do bot
//    faz o time parecer muito mais rápido/presente do que realmente está.
//
// Os campos first_customer_message_at/first_response_at que vêm prontos da
// Clint no chat misturam tudo isso (comentário, bot, humano) numa métrica
// só, por isso são ignorados aqui — tudo é recalculado a partir das
// mensagens (excluindo COMMENT), olhando quem mandou cada uma.
//
// Suporta os mesmos filtros de data/produto/funil do resumo geral
// (?from=YYYY-MM-DD&to=YYYY-MM-DD&product=...&origin=...), aplicados sobre o
// início da conversa (first_customer_message_at do chat) e o produto/funil
// do negócio mais recente do contato.

const UNANSWERED_LIMIT = 100;
const MULTI_CHANNEL_LIMIT = 100;
const RECENT_COMMENTS_LIMIT = 50;

interface AtendimentoFilters {
  from: string | null;
  to: string | null;
  product: string | null;
  origin: string | null;
}

function parseFilters(req: NextRequest): AtendimentoFilters {
  const sp = req.nextUrl.searchParams;
  return {
    from: sp.get("from") || null,
    to: sp.get("to") || null,
    product: sp.get("product") || null,
    origin: sp.get("origin") || null,
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
  if (filters.origin) {
    conditions.push(
      `EXISTS (SELECT 1 FROM clint_deals dfo WHERE dfo.contact_id = c.contact_id AND dfo.origin_id = (SELECT id FROM clint_origins WHERE name = $${i++} LIMIT 1))`
    );
    params.push(filters.origin);
  }
  return { sql: conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "", params };
}

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req);
    const chatFilter = buildChatFilterClause(filters, 1);
    const limitIndex = chatFilter.params.length + 1;

    // filtered_chats: chats dentro do filtro de data/produto/funil.
    // direct_pairs: por chat, primeira mensagem do cliente, primeira
    //   resposta HUMANA (user_id preenchido) e se já teve resposta de bot
    //   (user_id nulo) — olhando só mensagens que NÃO são comentário.
    // comment_counts: quantos comentários cada chat recebeu.
    const statsCte = `
      WITH filtered_chats AS (
        SELECT c.* FROM clint_chats c
        ${chatFilter.sql}
      ),
      direct_pairs AS (
        SELECT
          m.chat_id,
          MIN(m.clint_created_at) FILTER (WHERE m.type = 'CUSTOMER') AS first_customer_at,
          MIN(m.clint_created_at) FILTER (WHERE m.type != 'CUSTOMER' AND m.user_id IS NOT NULL) AS first_human_at,
          BOOL_OR(m.type != 'CUSTOMER' AND m.user_id IS NOT NULL) AS has_human_reply,
          BOOL_OR(m.type != 'CUSTOMER' AND m.user_id IS NULL) AS has_bot_reply,
          COUNT(*) AS direct_count
        FROM clint_messages m
        JOIN filtered_chats fc ON fc.id = m.chat_id
        WHERE m.content_type IS DISTINCT FROM 'COMMENT'
        GROUP BY m.chat_id
      ),
      comment_counts AS (
        SELECT m.chat_id, COUNT(*) AS comment_count
        FROM clint_messages m
        JOIN filtered_chats fc ON fc.id = m.chat_id
        WHERE m.content_type = 'COMMENT'
        GROUP BY m.chat_id
      )
    `;

    const [
      overviewResult,
      byOriginResult,
      unansweredResult,
      channelsResult,
      byChannelResult,
      multiChannelResult,
      recentCommentsResult,
    ] = await Promise.all([
      pool.query(
        `
        ${statsCte}
        SELECT
          (SELECT COUNT(*) FROM filtered_chats) AS total_chats,
          (SELECT COALESCE(SUM(direct_count), 0) FROM direct_pairs) AS total_direct_messages,
          (SELECT COALESCE(SUM(comment_count), 0) FROM comment_counts) AS total_comments,
          (SELECT COUNT(*) FROM direct_pairs WHERE first_customer_at IS NOT NULL) AS total_com_contato,
          (SELECT COUNT(*) FROM direct_pairs WHERE has_human_reply) AS total_atendimento_humano,
          (SELECT COUNT(*) FROM direct_pairs
             WHERE first_customer_at IS NOT NULL AND has_bot_reply AND NOT has_human_reply
          ) AS total_infoproduto,
          (SELECT COUNT(*) FROM direct_pairs
             WHERE first_customer_at IS NOT NULL AND NOT has_human_reply AND NOT has_bot_reply
          ) AS nunca_respondido,
          (SELECT AVG(EXTRACT(EPOCH FROM (first_human_at - first_customer_at)) / 60)
             FROM direct_pairs
             WHERE first_human_at IS NOT NULL AND first_customer_at IS NOT NULL AND first_human_at >= first_customer_at
          ) AS avg_response_minutes
        `,
        chatFilter.params
      ),
      pool.query(
        `
        ${statsCte}
        SELECT
          COALESCE(orig.name, 'Sem origem') AS origin_name,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE dp.has_bot_reply AND NOT dp.has_human_reply) AS total_infoproduto,
          COUNT(*) FILTER (WHERE NOT dp.has_human_reply AND NOT dp.has_bot_reply) AS nunca_respondido,
          AVG(EXTRACT(EPOCH FROM (dp.first_human_at - dp.first_customer_at)) / 60)
            FILTER (WHERE dp.first_human_at IS NOT NULL AND dp.first_human_at >= dp.first_customer_at) AS avg_response_minutes
        FROM filtered_chats c
        JOIN direct_pairs dp ON dp.chat_id = c.id
        LEFT JOIN LATERAL (
          SELECT origin_id FROM clint_deals dd WHERE dd.contact_id = c.contact_id ORDER BY clint_created_at DESC LIMIT 1
        ) d ON true
        LEFT JOIN clint_origins orig ON orig.id = d.origin_id
        WHERE dp.first_customer_at IS NOT NULL
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 15
        `,
        chatFilter.params
      ),
      pool.query(
        `
        ${statsCte},
        unanswered AS (
          SELECT c.id AS chat_id, c.contact_id, c.channel_account_id, dp.first_customer_at AS first_customer_message_at,
                 c.last_message_at, c.status
          FROM filtered_chats c
          JOIN direct_pairs dp ON dp.chat_id = c.id
          WHERE dp.first_customer_at IS NOT NULL AND NOT dp.has_human_reply AND NOT dp.has_bot_reply
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
          SELECT content FROM clint_messages m
          WHERE m.chat_id = u.chat_id AND m.content_type IS DISTINCT FROM 'COMMENT'
          ORDER BY clint_created_at DESC LIMIT 1
        ) lm ON true
        ORDER BY u.last_message_at DESC NULLS LAST
        `,
        [...chatFilter.params, UNANSWERED_LIMIT]
      ),
      pool.query(`SELECT id, name, type, status, identifier FROM clint_channel_accounts ORDER BY name`),
      pool.query(
        `
        ${statsCte}
        SELECT
          COALESCE(ch.name, 'Canal desconhecido') AS channel_name,
          COALESCE(ch.type, '—') AS channel_type,
          ch.status AS channel_status,
          COUNT(*) AS total,
          COALESCE(SUM(cc.comment_count), 0) AS total_comments,
          COUNT(*) FILTER (WHERE dp.has_bot_reply AND NOT dp.has_human_reply) AS total_infoproduto,
          COUNT(*) FILTER (WHERE dp.first_customer_at IS NOT NULL AND NOT dp.has_human_reply AND NOT dp.has_bot_reply) AS nunca_respondido,
          AVG(EXTRACT(EPOCH FROM (dp.first_human_at - dp.first_customer_at)) / 60)
            FILTER (WHERE dp.first_human_at IS NOT NULL AND dp.first_customer_at IS NOT NULL AND dp.first_human_at >= dp.first_customer_at) AS avg_response_minutes
        FROM filtered_chats c
        LEFT JOIN direct_pairs dp ON dp.chat_id = c.id
        LEFT JOIN comment_counts cc ON cc.chat_id = c.id
        LEFT JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        WHERE dp.first_customer_at IS NOT NULL OR cc.comment_count > 0
        GROUP BY 1, 2, 3
        ORDER BY total DESC
        `,
        chatFilter.params
      ),
      pool.query(
        `
        ${statsCte},
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
      pool.query(
        `
        ${statsCte}
        SELECT
          m.id,
          m.chat_id,
          m.content,
          m.clint_created_at,
          co.name AS contact_name,
          ch.name AS channel_name,
          ch.type AS channel_type
        FROM clint_messages m
        JOIN filtered_chats fc ON fc.id = m.chat_id
        LEFT JOIN clint_contacts co ON co.id = fc.contact_id
        LEFT JOIN clint_channel_accounts ch ON ch.id = fc.channel_account_id
        WHERE m.content_type = 'COMMENT'
        ORDER BY m.clint_created_at DESC
        LIMIT $${limitIndex}
        `,
        [...chatFilter.params, RECENT_COMMENTS_LIMIT]
      ),
    ]);

    const overview = overviewResult.rows[0];
    const totalComContato = Number(overview.total_com_contato);
    const nuncaRespondido = Number(overview.nunca_respondido);

    return NextResponse.json({
      overview: {
        totalChats: Number(overview.total_chats),
        totalDirectMessages: Number(overview.total_direct_messages),
        totalComments: Number(overview.total_comments),
        totalAtendimentoHumano: Number(overview.total_atendimento_humano),
        totalInfoproduto: Number(overview.total_infoproduto),
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
        totalComments: Number(r.total_comments),
        totalInfoproduto: Number(r.total_infoproduto),
        nuncaRespondido: Number(r.nunca_respondido),
        avgResponseMinutes: r.avg_response_minutes ? Number(r.avg_response_minutes) : null,
      })),
      byOrigin: byOriginResult.rows.map((r) => ({
        originName: r.origin_name,
        total: Number(r.total),
        totalInfoproduto: Number(r.total_infoproduto),
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
      comments: {
        total: Number(overview.total_comments),
        recent: recentCommentsResult.rows.map((r) => ({
          id: r.id,
          chatId: r.chat_id,
          content: r.content,
          createdAt: r.clint_created_at,
          contactName: r.contact_name || "(sem nome)",
          channelName: r.channel_name,
          channelType: r.channel_type,
        })),
      },
    });
  } catch (error) {
    console.error("Erro ao agregar dados de atendimento da Clint:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro ao carregar dados de atendimento: ${detail}` }, { status: 500 });
  }
}
