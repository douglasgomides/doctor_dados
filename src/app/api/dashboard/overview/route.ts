import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { scoreToTier } from "@/lib/status-tier";
import { ClienteOverviewRow, DashboardOverview, FeedItem, Reuniao, Roteiro } from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/dashboard. Lê diretamente das tabelas roteiros e
// reunioes deste app (validadas por IA em src/lib/roteiro-validator.ts e
// src/lib/reuniao-validator.ts) — não depende de nenhum pipeline externo.

const ROW_LIMIT = 500;
const ALERT_LIMIT = 20;
const FEED_LIMIT = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoteiroRow(row: any): Roteiro {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    clientId: row.client_id,
    clientName: row.client_name,
    format: row.format,
    title: row.title,
    content: row.content,
    status: row.status,
    score: row.score,
    issues: row.issues,
    reviewNote: row.review_note,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReuniaoRow(row: any): Reuniao {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    clientId: row.client_id,
    clientName: row.client_name,
    tipo: row.tipo,
    content: row.content,
    status: row.status,
    score: row.score,
    issues: row.issues,
    suggestedAgenda: row.suggested_agenda,
    reviewNote: row.review_note,
    reviewedByName: row.reviewed_by_name,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function GET() {
  try {
    const [roteirosResult, reunioesResult, clientesResult] = await Promise.all([
      pool.query(`SELECT * FROM roteiros ORDER BY created_at DESC LIMIT $1`, [ROW_LIMIT]),
      pool.query(`SELECT * FROM reunioes ORDER BY created_at DESC LIMIT $1`, [ROW_LIMIT]),
      pool.query(
        `SELECT c.nome, u.name AS responsavel_name
         FROM clientes c
         LEFT JOIN dash_users u ON u.id = c.responsavel_id`
      ),
    ]);

    const roteiros = roteirosResult.rows.map(mapRoteiroRow);
    const reunioes = reunioesResult.rows.map(mapReuniaoRow);

    const responsavelPorCliente = new Map<string, string | null>(
      clientesResult.rows.map((row) => [row.nome.toLowerCase(), row.responsavel_name])
    );

    // Ambas as listas já vêm ordenadas por created_at DESC, então o primeiro
    // roteiro/reunião visto por cliente é o mais recente.
    const latestRoteiroByCliente = new Map<string, Roteiro>();
    for (const r of roteiros) {
      if (!latestRoteiroByCliente.has(r.clientName)) latestRoteiroByCliente.set(r.clientName, r);
    }
    const latestReuniaoByCliente = new Map<string, Reuniao>();
    for (const r of reunioes) {
      if (!latestReuniaoByCliente.has(r.clientName)) latestReuniaoByCliente.set(r.clientName, r);
    }

    const pendentesPorCliente = new Map<string, number>();
    for (const r of [...roteiros, ...reunioes]) {
      if (r.status === "ajustar") {
        pendentesPorCliente.set(r.clientName, (pendentesPorCliente.get(r.clientName) || 0) + 1);
      }
    }

    const clienteNames = new Set<string>([
      ...latestRoteiroByCliente.keys(),
      ...latestReuniaoByCliente.keys(),
    ]);

    const clientes: ClienteOverviewRow[] = [...clienteNames].sort().map((cliente) => {
      const roteiro = latestRoteiroByCliente.get(cliente) || null;
      const reuniao = latestReuniaoByCliente.get(cliente) || null;
      return {
        cliente,
        responsavelName: responsavelPorCliente.get(cliente.toLowerCase()) || null,
        ultimoRoteiro: roteiro
          ? {
              data: roteiro.createdAt,
              status: roteiro.status,
              statusTier: scoreToTier(roteiro.status, roteiro.score),
              score: roteiro.score,
            }
          : null,
        ultimaReuniao: reuniao
          ? {
              data: reuniao.createdAt,
              status: reuniao.status,
              statusTier: scoreToTier(reuniao.status, reuniao.score),
              score: reuniao.score,
            }
          : null,
        pendentesAjuste: pendentesPorCliente.get(cliente) || 0,
      };
    });

    const feed: FeedItem[] = [
      ...roteiros.map((r) => ({ type: "roteiro" as const, data: r })),
      ...reunioes.map((r) => ({ type: "reuniao" as const, data: r })),
    ]
      .sort((a, b) => (a.data.createdAt < b.data.createdAt ? 1 : -1))
      .slice(0, FEED_LIMIT);

    const overview: DashboardOverview = {
      clientes,
      alerts: {
        roteirosParaAjustar: roteiros.filter((r) => r.status === "ajustar").slice(0, ALERT_LIMIT),
        reunioesParaAjustar: reunioes.filter((r) => r.status === "ajustar").slice(0, ALERT_LIMIT),
      },
      feed,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Erro ao montar visão geral:", error);
    return NextResponse.json({ error: "Erro ao montar visão geral." }, { status: 500 });
  }
}
