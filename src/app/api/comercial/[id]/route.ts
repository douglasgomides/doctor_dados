import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ComercialAnalise, ComercialResultado } from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/comercial. Só o resultado real do negócio é
// editável por aqui — o resto da análise vem da automação (ver
// /api/automations/comercial) e não deve ser alterado manualmente.

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
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { resultado, valorFechado } = await req.json();

    if (resultado !== null && !VALID_RESULTADOS.has(resultado)) {
      return NextResponse.json({ error: "Resultado inválido." }, { status: 400 });
    }
    if (valorFechado !== undefined && valorFechado !== null && typeof valorFechado !== "number") {
      return NextResponse.json({ error: "Valor fechado inválido." }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE comercial_analises SET resultado = $1, valor_fechado = $2 WHERE id = $3 RETURNING *`,
      [resultado, valorFechado ?? null, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Call comercial não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ analise: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao atualizar resultado comercial:", error);
    return NextResponse.json({ error: "Erro ao atualizar resultado comercial." }, { status: 500 });
  }
}
