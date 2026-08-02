import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { PerformanceOverview, TeamMemberPerformance } from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/dashboard. Agrega nota média e taxa de aprovação
// por pessoa da equipe, a partir dos próprios roteiros/reunioes — serve pra
// pegar um problema de qualidade recorrente de alguém antes que ele vire um
// problema visível pro cliente.

const ROW_LIMIT = 1000;

interface MemberAccumulator {
  roteirosTotal: number;
  roteirosScoreSoma: number;
  roteirosAprovados: number;
  reunioesTotal: number;
  reunioesScoreSoma: number;
  reunioesAprovados: number;
}

function average(sum: number, count: number): number {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
}

export async function GET() {
  try {
    const [roteirosResult, reunioesResult] = await Promise.all([
      pool.query(
        `SELECT author_name, score, status FROM roteiros ORDER BY created_at DESC LIMIT $1`,
        [ROW_LIMIT]
      ),
      pool.query(
        `SELECT author_name, score, status FROM reunioes ORDER BY created_at DESC LIMIT $1`,
        [ROW_LIMIT]
      ),
    ]);

    const porMembro = new Map<string, MemberAccumulator>();
    const getAcc = (nome: string) => {
      let acc = porMembro.get(nome);
      if (!acc) {
        acc = {
          roteirosTotal: 0,
          roteirosScoreSoma: 0,
          roteirosAprovados: 0,
          reunioesTotal: 0,
          reunioesScoreSoma: 0,
          reunioesAprovados: 0,
        };
        porMembro.set(nome, acc);
      }
      return acc;
    };

    let roteirosScoreSomaGeral = 0;
    for (const row of roteirosResult.rows) {
      const acc = getAcc(row.author_name);
      acc.roteirosTotal += 1;
      acc.roteirosScoreSoma += row.score;
      if (row.status === "aprovado") acc.roteirosAprovados += 1;
      roteirosScoreSomaGeral += row.score;
    }

    let reunioesScoreSomaGeral = 0;
    for (const row of reunioesResult.rows) {
      const acc = getAcc(row.author_name);
      acc.reunioesTotal += 1;
      acc.reunioesScoreSoma += row.score;
      if (row.status === "aprovado") acc.reunioesAprovados += 1;
      reunioesScoreSomaGeral += row.score;
    }

    const membros: TeamMemberPerformance[] = [...porMembro.entries()]
      .map(([authorName, acc]) => ({
        authorName,
        roteirosTotal: acc.roteirosTotal,
        roteirosScoreMedia: average(acc.roteirosScoreSoma, acc.roteirosTotal),
        roteirosTaxaAprovacao:
          acc.roteirosTotal > 0
            ? Math.round((acc.roteirosAprovados / acc.roteirosTotal) * 100)
            : 0,
        reunioesTotal: acc.reunioesTotal,
        reunioesScoreMedia: average(acc.reunioesScoreSoma, acc.reunioesTotal),
        reunioesTaxaAprovacao:
          acc.reunioesTotal > 0
            ? Math.round((acc.reunioesAprovados / acc.reunioesTotal) * 100)
            : 0,
      }))
      .sort((a, b) => a.authorName.localeCompare(b.authorName));

    const overview: PerformanceOverview = {
      membros,
      mediaGeralRoteiros: average(roteirosScoreSomaGeral, roteirosResult.rows.length),
      mediaGeralReunioes: average(reunioesScoreSomaGeral, reunioesResult.rows.length),
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Erro ao montar performance da equipe:", error);
    return NextResponse.json({ error: "Erro ao montar performance da equipe." }, { status: 500 });
  }
}
