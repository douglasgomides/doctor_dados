import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateComercial } from "@/lib/comercial-validator";
import { COMERCIAL_TITULO, COMERCIAL_PARTICIPANTES, COMERCIAL_CONTEUDO } from "@/lib/seed-exemplos-data";

export const maxDuration = 30;

export async function POST() {
  try {
    const validation = await validateComercial(COMERCIAL_CONTEUDO);

    await pool.query(
      `INSERT INTO comercial_analises (titulo, participantes, content, status, score, issues, pontos_fortes, pontos_melhoria)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        COMERCIAL_TITULO,
        JSON.stringify(COMERCIAL_PARTICIPANTES),
        COMERCIAL_CONTEUDO,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
        JSON.stringify(validation.pontosFortes),
        JSON.stringify(validation.pontosMelhoria),
      ]
    );

    return NextResponse.json({ success: true, status: validation.status, score: validation.score });
  } catch (error) {
    console.error("Erro ao gerar comercial de exemplo:", error);
    return NextResponse.json({ error: "Erro ao gerar comercial de exemplo." }, { status: 500 });
  }
}
