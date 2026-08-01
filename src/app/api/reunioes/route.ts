import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateReuniao } from "@/lib/reuniao-validator";
import { Reuniao, ReuniaoTipo } from "@/types";

// Autenticação é imposta pelo middleware (src/proxy.ts) para todo o
// prefixo /api/reunioes. GET retorna todas as reuniões para "master" e
// apenas as do próprio autor para os demais papéis.

const VALID_TIPOS = new Set<ReuniaoTipo>(["mentoria", "grupo", "onboarding", "pontual"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Reuniao {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    clientName: row.client_name,
    tipo: row.tipo,
    content: row.content,
    status: row.status,
    score: row.score,
    issues: row.issues,
    suggestedAgenda: row.suggested_agenda,
    reviewNote: row.review_note,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-session-role");
    const userId = req.headers.get("x-session-user-id");

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const tipoFilter = searchParams.get("tipo");

    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (role !== "master") {
      conditions.push(`author_id = $${paramIndex++}`);
      values.push(userId);
    }
    if (statusFilter) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(statusFilter);
    }
    if (tipoFilter) {
      conditions.push(`tipo = $${paramIndex++}`);
      values.push(tipoFilter);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM reunioes ${where} ORDER BY created_at DESC LIMIT 200`,
      values
    );

    return NextResponse.json({ reunioes: result.rows.map(mapRow) });
  } catch (error) {
    console.error("Erro ao listar reuniões:", error);
    return NextResponse.json({ error: "Erro ao listar reuniões." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-session-user-id");
    const authorName = req.headers.get("x-session-name");

    if (!userId || !authorName) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { clientName, tipo, content } = await req.json();

    if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
      return NextResponse.json({ error: "Informe o nome do médico/cliente." }, { status: 400 });
    }
    if (!VALID_TIPOS.has(tipo)) {
      return NextResponse.json({ error: "Tipo de reunião inválido." }, { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "A transcrição não pode estar vazia." }, { status: 400 });
    }

    const validation = await validateReuniao(tipo, content);

    const result = await pool.query(
      `INSERT INTO reunioes (author_id, author_name, client_name, tipo, content, status, score, issues, suggested_agenda)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        authorName,
        clientName.trim(),
        tipo,
        content,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
        JSON.stringify(validation.suggestedAgenda),
      ]
    );

    return NextResponse.json({ reuniao: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao validar reunião:", error);
    return NextResponse.json({ error: "Erro ao validar reunião." }, { status: 500 });
  }
}
