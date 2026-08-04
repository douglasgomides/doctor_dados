import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { fetchMessagesForChat, fetchChatsForContact } from "@/lib/clint";

// Endpoint de diagnóstico, só leitura, pra inspecionar o formato real das
// mensagens já sincronizadas de um canal específico (ex: Instagram) sem
// precisar chamar a API da Clint de novo — usado pra entender como
// distinguir resposta humana de resposta automática (ManyChat) e se
// "comentários" aparecem como um type/content_type separado de mensagem
// direta. Mesmo segredo do clint-sync, fora dos prefixos de sessão em
// src/proxy.ts, de propósito.
//
// GET /api/automations/clint-debug?channelType=INSTAGRAM&limit=25
export async function GET(req: NextRequest) {
  const secret = process.env.CLINT_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLINT_SYNC_SECRET não configurado no servidor." }, { status: 500 });
  }

  const providedSecret = req.headers.get("x-automation-secret");
  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const channelType = req.nextUrl.searchParams.get("channelType") || "INSTAGRAM";
  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 25));
  const chatIds = req.nextUrl.searchParams.getAll("chatId");
  const liveChatId = req.nextUrl.searchParams.get("liveChatId");
  const liveContactId = req.nextUrl.searchParams.get("liveContactId");
  const searchContact = req.nextUrl.searchParams.get("searchContact");

  // Modo "live": chama a API REST oficial da Clint (a mesma que já usamos
  // pra sincronizar) direto pra esse chat_id, sem passar pelo nosso banco —
  // pra testar se /v2/messages/chat/{chatId} reconhece um chat_id visto no
  // painel de Atendimento (GraphQL interno), mesmo que a gente nunca tenha
  // chegado nele via /v2/chats/contact/{contactId}.
  if (liveChatId) {
    try {
      const response = await fetchMessagesForChat(liveChatId, 1, 30);
      return NextResponse.json({ liveChatId, response });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      return NextResponse.json({ liveChatId, error: message });
    }
  }

  // Modo "live contato": chama /v2/chats/contact/{contactId} AO VIVO (não
  // do nosso banco) pra um contact_id específico — pra testar se o
  // endpoint documentado realmente devolve os chats de Instagram desse
  // contato, ou se devolve vazio mesmo com o contact_id certo.
  if (liveContactId) {
    try {
      const response = await fetchChatsForContact(liveContactId, 1, 200);
      return NextResponse.json({ liveContactId, response });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      return NextResponse.json({ liveContactId, error: message });
    }
  }

  // Modo "buscar contato": procura por nome/e-mail nos contatos e negócios
  // já sincronizados, pra achar o contact_id de uma pessoa específica (ex:
  // achada numa conversa de Instagram) e comparar com o contact_id que a
  // Clint usa pra atendimento.
  if (searchContact) {
    try {
      const term = `%${searchContact}%`;
      const [contactsResult, dealsResult] = await Promise.all([
        pool.query(
          `SELECT id, name, email, username, full_phone FROM clint_contacts WHERE name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1 LIMIT 20`,
          [term]
        ),
        pool.query(
          `
          SELECT d.id AS deal_id, d.contact_id, d.contact_name, d.fields->>'email' AS email,
                 COALESCE(o.name, 'Sem origem') AS origin_name, d.fields->>'fonte' AS fonte
          FROM clint_deals d
          LEFT JOIN clint_origins o ON o.id = d.origin_id
          WHERE d.contact_name ILIKE $1 OR d.fields->>'email' ILIKE $1
          LIMIT 20
          `,
          [term]
        ),
      ]);
      return NextResponse.json({ contacts: contactsResult.rows, deals: dealsResult.rows });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // Modo "lookup": dado um ou mais chat_id vistos no console/rede do painel
  // da Clint (ex: ?chatId=xxx&chatId=yyy), diz se cada um já existe no que
  // já sincronizamos — e se sim, de qual canal/contato ele é.
  if (chatIds.length > 0) {
    try {
      const result = await pool.query(
        `
        SELECT
          c.id AS chat_id,
          c.contact_id,
          co.name AS contact_name,
          c.channel_account_id,
          ch.name AS channel_name,
          ch.type AS channel_type,
          c.status,
          c.first_customer_message_at,
          c.last_message_at,
          (SELECT COUNT(*) FROM clint_messages m WHERE m.chat_id = c.id) AS message_count
        FROM clint_chats c
        LEFT JOIN clint_contacts co ON co.id = c.contact_id
        LEFT JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        WHERE c.id = ANY($1)
        `,
        [chatIds]
      );
      const found = new Map(result.rows.map((r) => [r.chat_id, r]));
      return NextResponse.json({
        lookup: chatIds.map((id) => {
          const row = found.get(id);
          if (!row) return { chatId: id, foundInDb: false };
          return {
            chatId: id,
            foundInDb: true,
            contactId: row.contact_id,
            contactName: row.contact_name,
            channelAccountId: row.channel_account_id,
            channelName: row.channel_name,
            channelType: row.channel_type,
            status: row.status,
            firstCustomerMessageAt: row.first_customer_message_at,
            lastMessageAt: row.last_message_at,
            messageCount: Number(row.message_count),
          };
        }),
      });
    } catch (error) {
      console.error("Erro no lookup de chat Clint:", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido.";
      return NextResponse.json({ error: `Falha no lookup: ${message}` }, { status: 500 });
    }
  }

  try {
    const [channelsResult, typesResult, sampleResult, chatsByChannelResult, originBreakdownResult] =
      await Promise.all([
      pool.query(
        `SELECT id, name, type, status, identifier FROM clint_channel_accounts WHERE type ILIKE $1 ORDER BY name`,
        [`%${channelType}%`]
      ),
      pool.query(
        `
        SELECT
          m.type,
          m.content_type,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE m.user_id IS NULL) AS sem_user_id
        FROM clint_messages m
        JOIN clint_chats c ON c.id = m.chat_id
        JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        WHERE ch.type ILIKE $1
        GROUP BY 1, 2
        ORDER BY total DESC
        `,
        [`%${channelType}%`]
      ),
      pool.query(
        `
        SELECT
          m.id,
          m.chat_id,
          m.user_id,
          m.type,
          m.content_type,
          m.status,
          m.clint_created_at,
          LEFT(m.content, 200) AS content_preview
        FROM clint_messages m
        JOIN clint_chats c ON c.id = m.chat_id
        JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        WHERE ch.type ILIKE $1
        ORDER BY m.clint_created_at DESC
        LIMIT $2
        `,
        [`%${channelType}%`, limit]
      ),
      // Distribuição de TODOS os chats já sincronizados por canal (inclui
      // channel_account_id nulo) — pra ver se o Instagram está mesmo
      // ausente dos chats sincronizados, ou só não apareceu na amostra.
      pool.query(`
        SELECT ch.name AS channel_name, ch.type AS channel_type, COUNT(*) AS total_chats
        FROM clint_chats c
        LEFT JOIN clint_channel_accounts ch ON ch.id = c.channel_account_id
        GROUP BY 1, 2
        ORDER BY total_chats DESC
      `),
      // Origem/fonte dos contatos com negócio, e quantos desses caem dentro
      // da janela dos ~1500 contatos mais recentes que a sincronização de
      // mensagens processa (MESSAGES_SYNC_CONTACT_LIMIT em clint-sync.ts) —
      // pra ver se contatos de Instagram estão sendo deixados de fora por
      // serem menos "recentes" que o volume de WhatsApp.
      pool.query(`
        WITH ranked AS (
          SELECT contact_id, ROW_NUMBER() OVER (ORDER BY MAX(clint_updated_at) DESC NULLS LAST) AS rn
          FROM clint_deals
          WHERE contact_id IS NOT NULL
          GROUP BY contact_id
        ),
        deal_origin AS (
          SELECT DISTINCT ON (contact_id) contact_id, origin_id, fields->>'fonte' AS fonte
          FROM clint_deals
          WHERE contact_id IS NOT NULL
          ORDER BY contact_id, clint_updated_at DESC NULLS LAST
        )
        SELECT
          COALESCE(o.name, 'Sem origem') AS origin_name,
          dorig.fonte,
          COUNT(*) AS total_contacts,
          COUNT(*) FILTER (WHERE r.rn <= 1500) AS dentro_da_janela_sincronizada
        FROM deal_origin dorig
        LEFT JOIN clint_origins o ON o.id = dorig.origin_id
        LEFT JOIN ranked r ON r.contact_id = dorig.contact_id
        GROUP BY 1, 2
        ORDER BY total_contacts DESC
        LIMIT 30
      `),
    ]);

    return NextResponse.json({
      channels: channelsResult.rows,
      messageTypeCounts: typesResult.rows.map((r) => ({
        type: r.type,
        contentType: r.content_type,
        total: Number(r.total),
        semUserId: Number(r.sem_user_id),
      })),
      sample: sampleResult.rows,
      chatsByChannel: chatsByChannelResult.rows.map((r) => ({
        channelName: r.channel_name,
        channelType: r.channel_type,
        totalChats: Number(r.total_chats),
      })),
      originBreakdown: originBreakdownResult.rows.map((r) => ({
        originName: r.origin_name,
        fonte: r.fonte,
        totalContacts: Number(r.total_contacts),
        dentroDaJanelaSincronizada: Number(r.dentro_da_janela_sincronizada),
      })),
    });
  } catch (error) {
    console.error("Erro no diagnóstico de mensagens Clint:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha no diagnóstico: ${message}` }, { status: 500 });
  }
}
