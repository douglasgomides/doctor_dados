import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateRoteiro } from "@/lib/roteiro-validator";
import {
  TAG,
  ROTEIRO_REEL_BOM,
  ROTEIRO_CARROSSEL_AJUSTAR,
} from "@/lib/seed-exemplos-data";

export const maxDuration = 30;

const VARIANTS = {
  bom: {
    format: "reel" as const,
    title: `${TAG} Reel sobre alimentação anti-inflamatória`,
    content: ROTEIRO_REEL_BOM,
  },
  ajustar: {
    format: "carrossel" as const,
    title: `${TAG} Carrossel sobre clareamento dental`,
    content: ROTEIRO_CARROSSEL_AJUSTAR,
  },
};

export async function POST(req: NextRequest) {
  try {
    const { which, authorId, authorName, clientId, clientName } = await req.json();
    const variant = VARIANTS[which as keyof typeof VARIANTS];
    if (!variant || !authorId || !authorName || !clientId || !clientName) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const validation = await validateRoteiro(variant.format, variant.content);

    await pool.query(
      `INSERT INTO roteiros (author_id, author_name, client_id, client_name, format, title, content, status, score, issues, is_test)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,
      [
        authorId,
        authorName,
        clientId,
        clientName,
        variant.format,
        variant.title,
        variant.content,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
      ]
    );

    return NextResponse.json({
      success: true,
      titulo: variant.title,
      status: validation.status,
      score: validation.score,
    });
  } catch (error) {
    console.error("Erro ao gerar roteiro de exemplo:", error);
    return NextResponse.json({ error: "Erro ao gerar roteiro de exemplo." }, { status: 500 });
  }
}
