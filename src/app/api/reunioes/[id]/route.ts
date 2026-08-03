import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateReuniao } from "@/lib/reuniao-validator";
import { findOrCreateClienteId } from "@/lib/clientes";
import { Reuniao, ReuniaoStatus, ReuniaoTipo } from "@/types";

// Autenticação é imposta pelo middleware (src/proxy.ts) para todo o
// prefixo /api/reunioes. Duas ações diferentes convivem aqui:
// - Revisão manual (status/reviewNote): só "master".
// - Edição de conteúdo (cliente/tipo/transcrição): "master" ou o autor
//   original da reunião — editar o conteúdo dispara nova validação.
// - Exclusão: mesma regra da edição (master ou autor original).

const VALID_STATUSES = new Set<ReuniaoStatus>(["aprovado", "ajustar"]);
const VALID_TIPOS = new Set<ReuniaoTipo>(["mentoria", "grupo", "onboarding", "pontual"]);

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
    const existing = await pool.query("SELECT * FROM reunioes WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
    }
    const row = existing.rows[0];
    const isAuthor = row.author_id === userId;

    if (!isMaster && !isAuthor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { status, reviewNote, clientName, tipo, content } = await req.json();

    if ((status !== undefined || reviewNote !== undefined) && !isMaster) {
      return NextResponse.json(
        { error: "Só master pode revisar status/observação." },
        { status: 403 }
      );
    }
    if (status !== undefined && !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    if (tipo !== undefined && !VALID_TIPOS.has(tipo)) {
      return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const conteudoMudou =
      (content !== undefined && content !== row.content) || (tipo !== undefined && tipo !== row.tipo);

    if (conteudoMudou) {
      const tipoFinal = tipo !== undefined ? tipo : row.tipo;
      const conteudoFinal = content !== undefined ? content : row.content;
      if (!conteudoFinal || !conteudoFinal.trim()) {
        return NextResponse.json({ error: "A transcrição não pode ficar vazia." }, { status: 400 });
      }
      const validation = await validateReuniao(tipoFinal, conteudoFinal);
      fields.push(`tipo = $${paramIndex++}`);
      values.push(tipoFinal);
      fields.push(`content = $${paramIndex++}`);
      values.push(conteudoFinal);
      fields.push(`status = $${paramIndex++}`);
      values.push(validation.status);
      fields.push(`score = $${paramIndex++}`);
      values.push(validation.score);
      fields.push(`issues = $${paramIndex++}`);
      values.push(JSON.stringify(validation.issues));
      fields.push(`suggested_agenda = $${paramIndex++}`);
      values.push(JSON.stringify(validation.suggestedAgenda));
      fields.push(`suggested_content_ideas = $${paramIndex++}`);
      values.push(JSON.stringify(validation.suggestedContentIdeas));
    } else if (status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    let novoClienteId: string | null = null;
    if (clientName !== undefined && clientName.trim() && clientName.trim() !== row.client_name) {
      novoClienteId = await findOrCreateClienteId(clientName);
      fields.push(`client_id = $${paramIndex++}`);
      values.push(novoClienteId);
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
      return NextResponse.json({ reuniao: mapRow(row) });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE reunioes SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    const reuniao = result.rows[0];

    // O formulário de edição só tem um campo de texto pra cliente — trocar
    // o nome aqui sempre resolve pra 1 cliente só, mesmo que a reunião
    // tivesse vindo da automação como reunião em grupo (vários clientes na
    // tabela de junção). Resincroniza reuniao_clientes com o que ficou
    // gravado em client_id, senão a tabela de junção fica com os clientes
    // antigos e a reunião continua aparecendo no histórico deles.
    if (novoClienteId) {
      await pool.query(`DELETE FROM reuniao_clientes WHERE reuniao_id = $1`, [id]);
      await pool.query(
        `INSERT INTO reuniao_clientes (reuniao_id, cliente_id, cliente_nome) VALUES ($1, $2, $3)`,
        [id, novoClienteId, reuniao.client_name]
      );
    }

    return NextResponse.json({ reuniao: mapRow(reuniao) });
  } catch (error) {
    console.error("Erro ao editar reunião:", error);
    return NextResponse.json({ error: "Erro ao editar reunião." }, { status: 500 });
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

    const existing = await pool.query("SELECT author_id FROM reunioes WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Reunião não encontrada." }, { status: 404 });
    }
    const isMaster = role === "master";
    const isAuthor = existing.rows[0].author_id === userId;
    if (!isMaster && !isAuthor) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    await pool.query("DELETE FROM reunioes WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir reunião:", error);
    return NextResponse.json({ error: "Erro ao excluir reunião." }, { status: 500 });
  }
}
