import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Métricas de atendimento (WhatsApp/Instagram, via chats/mensagens
// sincronizados — ver src/lib/clint-sync.ts, resource "messages"):
// tempo de resposta, leads nunca respondidos, e o texto da última
// mensagem de cada um. Protegido pelo prefixo /api/dashboard em
// src/proxy.ts (sessão master).

const UNANSWERED_LIMIT = 100;

export async function GET() {
  try {
    const [overviewResult, byOriginResult, unansweredResult] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM clint_chats) AS total_chats,
          (SELECT COUNT(*) FROM clint_messages) AS total_messages,
          (SELECT COUNT(*) FROM clint_chats WHERE first_customer_message_at IS NOT NULL) AS total_com_contato,
          (SELECT COUNT(*) FROM clint_chats WHERE first_customer_message_at IS NOT NULL AND first_response_at IS NULL) AS nunca_respondido,
          (SELECT AVG(EXTRACT(EPOCH FROM (first_response_at - first_customer_message_at)) / 60)
             FROM clint_chats
             WHERE first_response_at IS NOT NULL AND first_customer_message_at IS NOT NULL) AS avg_response_minutes
      `),
      pool.query(`
        SELECT
          COALESCE(orig.name, 'Sem origem') AS origin_name,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE c.first_customer_message_at IS NOT NULL AND c.first_response_at IS NULL) AS nunca_respondido,
          AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.first_customer_message_at)) / 60)
            FILTER (WHERE c.first_response_at IS NOT NULL AND c.first_customer_message_at IS NOT NULL) AS avg_response_minutes
        FROM clint_chats c
        LEFT JOIN LATERAL (
          SELECT origin_id FROM clint_deals dd WHERE dd.contact_id = c.contact_id ORDER BY clint_created_at DESC LIMIT 1
        ) d ON true
        LEFT JOIN clint_origins orig ON orig.id = d.origin_id
        WHERE c.first_customer_message_at IS NOT NULL
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 15
      `),
      pool.query(
        `
        WITH unanswered AS (
          SELECT c.id AS chat_id, c.contact_id, c.first_customer_message_at, c.last_message_at, c.status
          FROM clint_chats c
          WHERE c.first_customer_message_at IS NOT NULL AND c.first_response_at IS NULL
          ORDER BY c.last_message_at DESC NULLS LAST
          LIMIT $1
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
          lm.content AS last_message_content
        FROM unanswered u
        LEFT JOIN clint_contacts co ON co.id = u.contact_id
        LEFT JOIN LATERAL (
          SELECT stage, value, origin_id FROM clint_deals dd WHERE dd.contact_id = u.contact_id ORDER BY clint_created_at DESC LIMIT 1
        ) d ON true
        LEFT JOIN clint_origins orig ON orig.id = d.origin_id
        LEFT JOIN LATERAL (
          SELECT content FROM clint_messages m WHERE m.chat_id = u.chat_id ORDER BY clint_created_at DESC LIMIT 1
        ) lm ON true
        ORDER BY u.last_message_at DESC NULLS LAST
        `,
        [UNANSWERED_LIMIT]
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
        lastMessageContent: r.last_message_content,
      })),
    });
  } catch (error) {
    console.error("Erro ao agregar dados de atendimento da Clint:", error);
    return NextResponse.json({ error: "Erro ao carregar dados de atendimento." }, { status: 500 });
  }
}
