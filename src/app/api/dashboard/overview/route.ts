import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { statusToTier } from "@/lib/status-tier";
import {
  ClienteOverviewRow,
  CompromissoItem,
  ConteudoValidacaoRow,
  DashboardOverview,
  FeedItem,
  ReuniaoValidacaoRow,
  RiscoAberto,
  RiscoItem,
} from "@/types";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/dashboard. Lê das tabelas alimentadas pelo
// pipeline externo (n8n) — este app só consulta, nunca escreve nelas.

const FEED_LIMIT = 30;
const ALERT_LIMIT = 20;

function normalizeRisco(raw: unknown): RiscoItem {
  if (typeof raw === "string") return { descricao: raw, responsavel: null };
  const obj = (raw || {}) as Record<string, unknown>;
  return {
    descricao: String(obj.descricao ?? obj.texto ?? ""),
    responsavel: obj.responsavel ? String(obj.responsavel) : null,
  };
}

function normalizeCompromisso(raw: unknown): CompromissoItem {
  if (typeof raw === "string") return { descricao: raw, responsavel: null, prazo: null };
  const obj = (raw || {}) as Record<string, unknown>;
  return {
    descricao: String(obj.descricao ?? obj.texto ?? ""),
    responsavel: obj.responsavel ? String(obj.responsavel) : null,
    prazo: obj.prazo ? String(obj.prazo) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReuniaoRow(row: any): ReuniaoValidacaoRow {
  const riscosRaw = Array.isArray(row.riscos) ? row.riscos : [];
  const compromissosRaw = Array.isArray(row.compromissos) ? row.compromissos : [];
  return {
    id: row.id,
    arquivoNome: row.arquivo_nome,
    cliente: row.cliente,
    status: row.status,
    statusTier: statusToTier(row.status),
    resumo: row.resumo,
    compromissos: compromissosRaw.map(normalizeCompromisso),
    riscos: riscosRaw.map(normalizeRisco),
    pautaProxima: row.pauta_proxima,
    recapMensagem: row.recap_mensagem,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConteudoRow(row: any): ConteudoValidacaoRow {
  const tier = statusToTier(
    [row.status_texto, row.status_arte].filter(Boolean).join(" ") || null
  );
  return {
    id: row.id,
    pecaNome: row.peca_nome,
    cliente: row.cliente,
    tipo: row.tipo,
    statusTexto: row.status_texto,
    statusArte: row.status_arte,
    statusTier: tier,
    feedback: row.feedback,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function GET() {
  try {
    const [latestReunioes, latestConteudos, incompletas, reprovados, feedReunioes, feedConteudos] =
      await Promise.all([
        pool.query(
          `SELECT DISTINCT ON (cliente) * FROM reuniao_validacoes ORDER BY cliente, created_at DESC`
        ),
        pool.query(
          `SELECT DISTINCT ON (cliente) * FROM conteudo_validacoes ORDER BY cliente, created_at DESC`
        ),
        pool.query(
          `SELECT * FROM reuniao_validacoes WHERE status ILIKE '%incomplet%' ORDER BY created_at DESC LIMIT $1`,
          [ALERT_LIMIT]
        ),
        pool.query(
          `SELECT * FROM conteudo_validacoes
           WHERE status_texto ILIKE '%reprovad%' OR status_arte ILIKE '%reprovad%'
           ORDER BY created_at DESC LIMIT $1`,
          [ALERT_LIMIT]
        ),
        pool.query(`SELECT * FROM reuniao_validacoes ORDER BY created_at DESC LIMIT $1`, [
          FEED_LIMIT,
        ]),
        pool.query(`SELECT * FROM conteudo_validacoes ORDER BY created_at DESC LIMIT $1`, [
          FEED_LIMIT,
        ]),
      ]);

    const latestReuniaoByCliente = new Map(
      latestReunioes.rows.map((r) => [r.cliente, mapReuniaoRow(r)])
    );
    const latestConteudoByCliente = new Map(
      latestConteudos.rows.map((r) => [r.cliente, mapConteudoRow(r)])
    );

    const clienteNames = new Set<string>([
      ...latestReuniaoByCliente.keys(),
      ...latestConteudoByCliente.keys(),
    ]);

    const clientes: ClienteOverviewRow[] = [...clienteNames].sort().map((cliente) => {
      const reuniao = latestReuniaoByCliente.get(cliente) || null;
      const conteudo = latestConteudoByCliente.get(cliente) || null;
      const riscosAbertos = reuniao
        ? reuniao.riscos.filter((r) => !r.responsavel).length
        : 0;
      return {
        cliente,
        ultimaReuniao: reuniao
          ? { data: reuniao.createdAt, status: reuniao.status, statusTier: reuniao.statusTier }
          : null,
        ultimoConteudo: conteudo
          ? {
              data: conteudo.createdAt,
              status: conteudo.statusTexto || conteudo.statusArte || "",
              statusTier: conteudo.statusTier,
            }
          : null,
        riscosAbertos,
      };
    });

    const riscosAbertos: RiscoAberto[] = [...latestReuniaoByCliente.entries()].flatMap(
      ([cliente, reuniao]) =>
        reuniao.riscos
          .filter((r) => !r.responsavel && r.descricao)
          .map((r) => ({ cliente, descricao: r.descricao, createdAt: reuniao.createdAt }))
    );

    const feed: FeedItem[] = [
      ...feedReunioes.rows.map((r) => ({ type: "reuniao" as const, data: mapReuniaoRow(r) })),
      ...feedConteudos.rows.map((r) => ({ type: "conteudo" as const, data: mapConteudoRow(r) })),
    ]
      .sort((a, b) => (a.data.createdAt < b.data.createdAt ? 1 : -1))
      .slice(0, FEED_LIMIT);

    const overview: DashboardOverview = {
      clientes,
      alerts: {
        reunioesIncompletas: incompletas.rows.map(mapReuniaoRow),
        riscosAbertos,
        conteudoReprovado: reprovados.rows.map(mapConteudoRow),
      },
      feed,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Erro ao montar visão geral:", error);
    return NextResponse.json({ error: "Erro ao montar visão geral." }, { status: 500 });
  }
}
