import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ComercialAnalise } from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/comercial. Só leitura — as análises são criadas
// pela automação (ver /api/automations/comercial), não por um formulário
// aqui dentro.

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
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function GET() {
  try {
    const result = await pool.query(
      "SELECT * FROM comercial_analises ORDER BY created_at DESC LIMIT 200"
    );
    return NextResponse.json({ analises: result.rows.map(mapRow) });
  } catch (error) {
    console.error("Erro ao listar análises comerciais:", error);
    return NextResponse.json({ error: "Erro ao listar análises comerciais." }, { status: 500 });
  }
}
