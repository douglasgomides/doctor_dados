import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

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

  try {
    const [channelsResult, typesResult, sampleResult] = await Promise.all([
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
    });
  } catch (error) {
    console.error("Erro no diagnóstico de mensagens Clint:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha no diagnóstico: ${message}` }, { status: 500 });
  }
}
