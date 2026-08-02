import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { Reuniao, ReuniaoStatus } from "@/types";

// Autenticação é imposta pelo middleware (src/proxy.ts) para todo o
// prefixo /api/reunioes. A revisão manual é restrita ao papel "master" aqui,
// já que não há um prefixo dedicado só para esta sub-rota no middleware.

const VALID_STATUSES = new Set<ReuniaoStatus>(["aprovado", "ajustar"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Reuniao {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    clientId: row.client_id,
    clientName: row.client_name,
    tipo: row.tipo,
    content: row.content,
    status: row.status,
    score: row.score,
    issues: row.issues,
    suggestedAgenda: row.suggested_agenda,
    suggestedContentIdeas: row.suggested_content_ideas,
    reviewNote: row.review_note,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.headers.get("x-session-role");
    const reviewerName = req.headers.get("x-session-name");

    if (role !== "master") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const { status, reviewNote } = await req.json();

    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (reviewNote !== undefined) {
      fields.push(`review_note = $${paramIndex++}`);
      values.push(reviewNote);
    }
    fields.push(`reviewed_by_name = $${paramIndex++}`);
    values.push(reviewerName);
    fields.push(`reviewed_at = NOW()`);

    values.push(id);

    const result = await pool.query(
      `UPDATE reunioes SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ reuniao: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao revisar reunião:", error);
    return NextResponse.json({ error: "Erro ao revisar reunião." }, { status: 500 });
  }
}
