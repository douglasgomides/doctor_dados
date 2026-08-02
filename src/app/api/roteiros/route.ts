import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateRoteiro } from "@/lib/roteiro-validator";
import { findOrCreateClienteId } from "@/lib/clientes";
import { Roteiro, RoteiroFormat } from "@/types";

// Autenticação é imposta pelo middleware (src/proxy.ts) para todo o
// prefixo /api/roteiros. GET retorna todos os roteiros para "master" e
// apenas os do próprio autor para os demais papéis (equipe validando o
// próprio material antes de enviar).

const VALID_FORMATS = new Set<RoteiroFormat>(["reel", "carrossel", "stories"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Roteiro {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    clientId: row.client_id,
    clientName: row.client_name,
    format: row.format,
    title: row.title,
    content: row.content,
    status: row.status,
    score: row.score,
    issues: row.issues,
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
    const formatFilter = searchParams.get("format");

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
    if (formatFilter) {
      conditions.push(`format = $${paramIndex++}`);
      values.push(formatFilter);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM roteiros ${where} ORDER BY created_at DESC LIMIT 200`,
      values
    );

    return NextResponse.json({ roteiros: result.rows.map(mapRow) });
  } catch (error) {
    console.error("Erro ao listar roteiros:", error);
    return NextResponse.json({ error: "Erro ao listar roteiros." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get("x-session-user-id");
    const authorName = req.headers.get("x-session-name");

    if (!userId || !authorName) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { clientName, format, title, content } = await req.json();

    if (!clientName || typeof clientName !== "string" || !clientName.trim()) {
      return NextResponse.json({ error: "Informe o nome do médico/cliente." }, { status: 400 });
    }
    if (!VALID_FORMATS.has(format)) {
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    }
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "O roteiro não pode estar vazio." }, { status: 400 });
    }

    const validation = await validateRoteiro(format, content);
    const clientId = await findOrCreateClienteId(clientName);

    const result = await pool.query(
      `INSERT INTO roteiros (author_id, author_name, client_id, client_name, format, title, content, status, score, issues)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userId,
        authorName,
        clientId,
        clientName.trim(),
        format,
        (title || "").trim(),
        content,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
      ]
    );

    return NextResponse.json({ roteiro: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao validar roteiro:", error);
    return NextResponse.json({ error: "Erro ao validar roteiro." }, { status: 500 });
  }
}
