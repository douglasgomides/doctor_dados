import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { validateReuniao } from "@/lib/reuniao-validator";
import { REUNIAO_MENTORIA_BOA, REUNIAO_MENTORIA_AJUSTAR } from "@/lib/seed-exemplos-data";
import { requireFreshMasterSession } from "@/lib/session-guard";

export const maxDuration = 30;

const VARIANTS = {
  boa: REUNIAO_MENTORIA_BOA,
  ajustar: REUNIAO_MENTORIA_AJUSTAR,
};

export async function POST(req: NextRequest) {
  try {
    const denied = await requireFreshMasterSession(req);
    if (denied) return denied;

    const { which, authorId, authorName, clientId, clientName } = await req.json();
    const content = VARIANTS[which as keyof typeof VARIANTS];
    if (!content || !authorId || !authorName || !clientId || !clientName) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const validation = await validateReuniao("mentoria", content);

    await pool.query(
      `INSERT INTO reunioes (author_id, author_name, client_id, client_name, tipo, content, status, score, issues, suggested_agenda, suggested_content_ideas, is_test)
       VALUES ($1,$2,$3,$4,'mentoria',$5,$6,$7,$8,$9,$10,true)`,
      [
        authorId,
        authorName,
        clientId,
        clientName,
        content,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
        JSON.stringify(validation.suggestedAgenda),
        JSON.stringify(validation.suggestedContentIdeas),
      ]
    );

    return NextResponse.json({ success: true, status: validation.status, score: validation.score });
  } catch (error) {
    console.error("Erro ao gerar reunião de exemplo:", error);
    return NextResponse.json({ error: "Erro ao gerar reunião de exemplo." }, { status: 500 });
  }
}
