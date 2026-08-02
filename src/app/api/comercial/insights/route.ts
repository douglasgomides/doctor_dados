import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ComercialIssue, ComercialResultado } from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/comercial. Agrega os "issues" (problemas
// identificados pela IA) de todas as calls comerciais por regra (rule),
// contando frequência e — quando já existe resultado real registrado
// (ver /api/comercial/[id]) — cruzando com taxa de fechamento, pra virar
// pauta de treinamento do time comercial.

interface Row {
  issues: ComercialIssue[];
  resultado: ComercialResultado | null;
}

export async function GET() {
  try {
    const result = await pool.query<Row>("SELECT issues, resultado FROM comercial_analises");
    const rows = result.rows;

    const totalCalls = rows.length;
    const comResultadoGeral = rows.filter((r) => r.resultado != null);
    const fechouGeral = comResultadoGeral.filter((r) => r.resultado === "fechou").length;
    const taxaFechoGeral =
      comResultadoGeral.length > 0 ? Math.round((fechouGeral / comResultadoGeral.length) * 100) : null;

    interface Acc {
      rule: string;
      ocorrencias: number;
      comResultado: number;
      fechou: number;
      exemplos: string[];
    }
    const porRegra = new Map<string, Acc>();

    for (const row of rows) {
      const regrasNaCall = new Map<string, string>();
      for (const issue of row.issues || []) {
        if (!regrasNaCall.has(issue.rule)) regrasNaCall.set(issue.rule, issue.message);
      }
      for (const [rule, mensagem] of regrasNaCall) {
        if (!porRegra.has(rule)) {
          porRegra.set(rule, { rule, ocorrencias: 0, comResultado: 0, fechou: 0, exemplos: [] });
        }
        const acc = porRegra.get(rule)!;
        acc.ocorrencias += 1;
        if (row.resultado != null) acc.comResultado += 1;
        if (row.resultado === "fechou") acc.fechou += 1;
        if (acc.exemplos.length < 3 && !acc.exemplos.includes(mensagem)) acc.exemplos.push(mensagem);
      }
    }

    const insights = [...porRegra.values()]
      .map((acc) => ({
        rule: acc.rule,
        ocorrencias: acc.ocorrencias,
        percentualDasCalls: totalCalls > 0 ? Math.round((acc.ocorrencias / totalCalls) * 100) : 0,
        taxaFechoComProblema:
          acc.comResultado > 0 ? Math.round((acc.fechou / acc.comResultado) * 100) : null,
        exemplos: acc.exemplos,
      }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias);

    return NextResponse.json({
      totalCalls,
      callsComResultado: comResultadoGeral.length,
      taxaFechoGeral,
      insights,
    });
  } catch (error) {
    console.error("Erro ao montar insights comerciais:", error);
    return NextResponse.json({ error: "Erro ao montar insights comerciais." }, { status: 500 });
  }
}
