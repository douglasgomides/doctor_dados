import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { extractDailyItems } from "@/lib/daily-extractor";

// Endpoint de escrita pra automação externa (n8n) extrair os itens de ação
// de uma daily interna. Protegido pelo mesmo segredo compartilhado de
// /api/automations/alerts e /api/automations/reunioes (header
// "x-automation-secret"). Guarda um registro próprio (auditoria) E devolve
// a lista de itens pro n8n criar as tarefas correspondentes no ClickUp,
// na lista de cada responsável.

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

    const itens = await extractDailyItems(transcricao);

    const result = await pool.query(
      `INSERT INTO daily_tarefas (titulo, participantes, itens)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [
        titulo || "",
        JSON.stringify(Array.isArray(participantes) ? participantes : []),
        JSON.stringify(itens),
      ]
    );

    return NextResponse.json({ dailyTarefasId: result.rows[0].id, itens });
  } catch (error) {
    console.error("Erro ao extrair itens da daily:", error);
    return NextResponse.json({ error: "Erro ao extrair itens da daily." }, { status: 500 });
  }
}
