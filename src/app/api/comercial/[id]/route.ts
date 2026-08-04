import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateComercial } from "@/lib/comercial-validator";
import { registrarAuditoria } from "@/lib/audit-log";
import { ComercialAnalise, ComercialResultado } from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/comercial — Comercial já é master-only por
// inteiro, então não há checagem extra de "autor" aqui como em Roteiros/
// Reuniões. Duas coisas editáveis: o resultado real do negócio (fluxo já
// existente), e agora também título/participantes/transcrição — editar a
// transcrição dispara nova validação (nota/feedback atualizados).

const VALID_RESULTADOS = new Set<ComercialResultado>(["fechou", "nao_fechou", "em_negociacao"]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): ComercialAnalise {
  return {
    id: row.id,
    titulo: row.titulo,
    participantes: row.participantes,
    content: row.content,
    status: row.status,
    score: row.score,
    issues: row.issues,
    pontosFortes: row.pontos_fortes,
    pontosMelhoria: row.pontos_melhoria,
    resultado: row.resultado,
    valorFechado: row.valor_fechado != null ? Number(row.valor_fechado) : null,
    isTest: row.is_test,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get("x-session-user-id");
    const sessionName = req.headers.get("x-session-name");
    const { id } = await params;
    const existing = await pool.query("SELECT * FROM comercial_analises WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Call comercial não encontrada." }, { status: 404 });
    }
    const row = existing.rows[0];

    const { resultado, valorFechado, titulo, participantes, content } = await req.json();

    if (resultado !== undefined && resultado !== null && !VALID_RESULTADOS.has(resultado)) {
      return NextResponse.json({ error: "Resultado inválido." }, { status: 400 });
    }
    if (valorFechado !== undefined && valorFechado !== null && typeof valorFechado !== "number") {
      return NextResponse.json({ error: "Valor fechado inválido." }, { status: 400 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (resultado !== undefined) {
      fields.push(`resultado = $${paramIndex++}`);
      values.push(resultado);
    }
    if (valorFechado !== undefined) {
      fields.push(`valor_fechado = $${paramIndex++}`);
      values.push(valorFechado);
    }
    if (titulo !== undefined) {
      fields.push(`titulo = $${paramIndex++}`);
      values.push(titulo.trim());
    }
    if (participantes !== undefined) {
      fields.push(`participantes = $${paramIndex++}`);
      values.push(JSON.stringify(participantes));
    }

    if (content !== undefined && content !== row.content) {
      if (!content.trim()) {
        return NextResponse.json({ error: "A transcrição não pode ficar vazia." }, { status: 400 });
      }
      const validation = await validateComercial(content);
      fields.push(`content = $${paramIndex++}`);
      values.push(content);
      fields.push(`status = $${paramIndex++}`);
      values.push(validation.status);
      fields.push(`score = $${paramIndex++}`);
      values.push(validation.score);
      fields.push(`issues = $${paramIndex++}`);
      values.push(JSON.stringify(validation.issues));
      fields.push(`pontos_fortes = $${paramIndex++}`);
      values.push(JSON.stringify(validation.pontosFortes));
      fields.push(`pontos_melhoria = $${paramIndex++}`);
      values.push(JSON.stringify(validation.pontosMelhoria));
    }

    if (fields.length === 0) {
      return NextResponse.json({ analise: mapRow(row) });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE comercial_analises SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    await registrarAuditoria({
      entityType: "comercial",
      entityId: id,
      action: "edit",
      actorId: userId,
      actorName: sessionName,
      before: row,
      after: result.rows[0],
    });

    return NextResponse.json({ analise: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao editar call comercial:", error);
    return NextResponse.json({ error: "Erro ao editar call comercial." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = req.headers.get("x-session-user-id");
    const sessionName = req.headers.get("x-session-name");
    const { id } = await params;
    const result = await pool.query("DELETE FROM comercial_analises WHERE id = $1 RETURNING *", [
      id,
    ]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Call comercial não encontrada." }, { status: 404 });
    }

    await registrarAuditoria({
      entityType: "comercial",
      entityId: id,
      action: "delete",
      actorId: userId,
      actorName: sessionName,
      before: result.rows[0],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao excluir call comercial:", error);
    return NextResponse.json({ error: "Erro ao excluir call comercial." }, { status: 500 });
  }
}
