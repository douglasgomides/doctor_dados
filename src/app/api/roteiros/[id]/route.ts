import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateRoteiro } from "@/lib/roteiro-validator";
import { findOrCreateClienteId } from "@/lib/clientes";
import { Roteiro, RoteiroFormat, RoteiroStatus } from "@/types";

// Autenticação é imposta pelo middleware (src/proxy.ts) para todo o
// prefixo /api/roteiros. Duas ações diferentes convivem aqui:
// - Revisão manual (status/reviewNote): só "master".
// - Edição de conteúdo (cliente/formato/título/conteúdo): "master" ou o
//   autor original do roteiro — editar o conteúdo dispara nova validação
//   (nota/issues atualizados), não é só trocar o texto.
// - Exclusão: mesma regra da edição (master ou autor original).

const VALID_STATUSES = new Set<RoteiroStatus>(["aprovado", "ajustar"]);
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
    isTest: row.is_test,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.headers.get("x-session-role");
    const userId = req.headers.get("x-session-user-id");
    const sessionName = req.headers.get("x-session-name");
    const isMaster = role === "master";

    const { id } = await params;
    const existing = await pool.query("SELECT * FROM roteiros WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Roteiro não encontrado." }, { status: 404 });
    }
    const row = existing.rows[0];
    const isAuthor = row.author_id === userId;

    if (!isMaster && !isAuthor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { status, reviewNote, clientName, format, title, content } = await req.json();

    if ((status !== undefined || reviewNote !== undefined) && !isMaster) {
      return NextResponse.json(
        { error: "Só master pode revisar status/observação." },
        { status: 403 }
      );
    }
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    if (format !== undefined && !VALID_FORMATS.has(format)) {
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const conteudoMudou =
      (content !== undefined && content !== row.content) ||
      (format !== undefined && format !== row.format);

    if (conteudoMudou) {
      const formatoFinal = format !== undefined ? format : row.format;
      const conteudoFinal = content !== undefined ? content : row.content;
      if (!conteudoFinal || !conteudoFinal.trim()) {
        return NextResponse.json({ error: "O roteiro não pode ficar vazio." }, { status: 400 });
      }
      const validation = await validateRoteiro(formatoFinal, conteudoFinal);
      fields.push(`format = $${paramIndex++}`);
      values.push(formatoFinal);
      fields.push(`content = $${paramIndex++}`);
      values.push(conteudoFinal);
      fields.push(`status = $${paramIndex++}`);
      values.push(validation.status);
      fields.push(`score = $${paramIndex++}`);
      values.push(validation.score);
      fields.push(`issues = $${paramIndex++}`);
      values.push(JSON.stringify(validation.issues));
    } else if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(title.trim());
    }

    if (clientName !== undefined && clientName.trim() && clientName.trim() !== row.client_name) {
      const clientId = await findOrCreateClienteId(clientName);
      fields.push(`client_id = $${paramIndex++}`);
      values.push(clientId);
      fields.push(`client_name = $${paramIndex++}`);
      values.push(clientName.trim());
    }

    if (reviewNote !== undefined) {
      fields.push(`review_note = $${paramIndex++}`);
      values.push(reviewNote);
    }
    if (isMaster && (status !== undefined || reviewNote !== undefined)) {
      fields.push(`reviewed_by_name = $${paramIndex++}`);
      values.push(sessionName);
      fields.push(`reviewed_at = NOW()`);
    }

    if (fields.length === 0) {
      return NextResponse.json({ roteiro: mapRow(row) });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE roteiros SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return NextResponse.json({ roteiro: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao editar roteiro:", error);
    return NextResponse.json({ error: "Erro ao editar roteiro." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const role = req.headers.get("x-session-role");
    const userId = req.headers.get("x-session-user-id");
    const { id } = await params;

    const existing = await pool.query("SELECT author_id FROM roteiros WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Roteiro não encontrado." }, { status: 404 });
    }
    const isMaster = role === "master";
    const isAuthor = existing.rows[0].author_id === userId;
    if (!isMaster && !isAuthor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await pool.query("DELETE FROM roteiros WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir roteiro:", error);
    return NextResponse.json({ error: "Erro ao excluir roteiro." }, { status: 500 });
  }
}
