import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateComercial } from "@/lib/comercial-validator";
import { ComercialAnalise } from "@/types";

// Endpoint de escrita pra automação externa (n8n) importar e analisar calls
// comerciais automaticamente. Protegido pelo mesmo segredo compartilhado de
// /api/automations/alerts e /api/automations/reunioes (header
// "x-automation-secret") — não fica sob nenhum prefixo autenticado no
// middleware, porque quem chama é um serviço, não um navegador logado.
// A leitura pro app (tela de master) fica em /api/comercial, que já é
// protegida por sessão.

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

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.AUTOMATION_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "AUTOMATION_API_SECRET não configurado no servidor." },
        { status: 500 }
      );
    }

    const providedSecret = req.headers.get("x-automation-secret");
    if (!providedSecret || providedSecret !== secret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { titulo, participantes, transcricao } = await req.json();

    if (!transcricao || typeof transcricao !== "string" || !transcricao.trim()) {
      return NextResponse.json({ error: "A transcrição não pode estar vazia." }, { status: 400 });
    }

    const validation = await validateComercial(transcricao);

    const result = await pool.query(
      `INSERT INTO comercial_analises (titulo, participantes, content, status, score, issues, pontos_fortes, pontos_melhoria)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        titulo || "",
        JSON.stringify(Array.isArray(participantes) ? participantes : []),
        transcricao,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
        JSON.stringify(validation.pontosFortes),
        JSON.stringify(validation.pontosMelhoria),
      ]
    );

    return NextResponse.json({ analise: mapRow(result.rows[0]) });
  } catch (error) {
    console.error("Erro ao analisar call comercial:", error);
    return NextResponse.json({ error: "Erro ao analisar call comercial." }, { status: 500 });
  }
}
