import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Agregações do espelho local dos dados da Clint (ver src/lib/clint-sync.ts)
// para o dashboard de Inteligência Comercial. Protegido por sessão master —
// já coberto pelo prefixo /api/dashboard em src/proxy.ts.

const WEEKS_BACK = 12;
const MIN_VOLUME_FOR_RATE = 8; // volume mínimo pra uma origem/produto entrar nos insights de "melhor/pior"

interface WeeklyPoint {
  week: string;
  count: number;
}

interface OriginRow {
  originId: string | null;
  originName: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  revenue: number;
}

interface ProductRow {
  product: string;
  total: number;
  revenue: number;
}

interface StageRow {
  stage: string;
  stageId: string | null;
  count: number;
  value: number;
}

interface TagRow {
  name: string;
  count: number;
}

function winRate(won: number, lost: number): number | null {
  const decided = won + lost;
  return decided > 0 ? won / decided : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toWeeklySeries(rows: any[]): WeeklyPoint[] {
  return rows.map((r) => ({ week: new Date(r.week).toISOString().slice(0, 10), count: Number(r.count) }));
}

export async function GET() {
  try {
    const [
      overviewResult,
      contactsWeeklyResult,
      dealsCreatedWeeklyResult,
      dealsWonWeeklyResult,
      stagesResult,
      originsResult,
      productsResult,
      fontesResult,
      tagsResult,
      contactsWithDealResult,
      cycleTimeResult,
      originProductResult,
    ] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM clint_contacts) AS total_contacts,
          (SELECT COUNT(*) FROM clint_deals) AS total_deals,
          (SELECT COUNT(*) FROM clint_deals WHERE status = 'OPEN') AS open_deals,
          (SELECT COUNT(*) FROM clint_deals WHERE status = 'WON') AS won_deals,
          (SELECT COUNT(*) FROM clint_deals WHERE status = 'LOST') AS lost_deals,
          (SELECT COALESCE(SUM(value), 0) FROM clint_deals WHERE status = 'WON') AS total_revenue,
          (SELECT COALESCE(AVG(value), 0) FROM clint_deals WHERE status = 'WON' AND value > 0) AS avg_ticket
      `),
      pool.query(`
        SELECT date_trunc('week', clint_created_at) AS week, COUNT(*) AS count
        FROM clint_contacts
        WHERE clint_created_at > NOW() - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT date_trunc('week', clint_created_at) AS week, COUNT(*) AS count
        FROM clint_deals
        WHERE clint_created_at > NOW() - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT date_trunc('week', won_at) AS week, COUNT(*) AS count
        FROM clint_deals
        WHERE status = 'WON' AND won_at > NOW() - INTERVAL '${WEEKS_BACK} weeks'
        GROUP BY 1 ORDER BY 1
      `),
      pool.query(`
        SELECT stage, stage_id, COUNT(*) AS count, COALESCE(SUM(value), 0) AS value
        FROM clint_deals
        WHERE status = 'OPEN' AND stage IS NOT NULL
        GROUP BY stage, stage_id
        ORDER BY count DESC
      `),
      pool.query(`
        SELECT
          d.origin_id AS origin_id,
          COALESCE(o.name, 'Sem origem') AS origin_name,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE d.status = 'WON') AS won,
          COUNT(*) FILTER (WHERE d.status = 'LOST') AS lost,
          COUNT(*) FILTER (WHERE d.status = 'OPEN') AS open,
          COALESCE(SUM(d.value) FILTER (WHERE d.status = 'WON'), 0) AS revenue
        FROM clint_deals d
        LEFT JOIN clint_origins o ON o.id = d.origin_id
        GROUP BY d.origin_id, o.name
        ORDER BY total DESC
      `),
      pool.query(`
        SELECT
          COALESCE(fields->>'product_name', fields->>'produto') AS product,
          COUNT(*) AS total,
          COALESCE(SUM(value), 0) AS revenue
        FROM clint_deals
        WHERE status = 'WON' AND COALESCE(fields->>'product_name', fields->>'produto') IS NOT NULL
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT
          COALESCE(fields->>'fonte', '(sem fonte)') AS fonte,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'WON') AS won,
          COUNT(*) FILTER (WHERE status = 'LOST') AS lost
        FROM clint_deals
        GROUP BY 1
        ORDER BY total DESC
        LIMIT 15
      `),
      pool.query(`
        SELECT tag->>'name' AS name, COUNT(*) AS count
        FROM clint_contacts, jsonb_array_elements(tags) AS tag
        WHERE tag->>'name' IS NOT NULL AND tag->>'name' != ''
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 15
      `),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE has_deal) AS with_deal,
          COUNT(*) FILTER (WHERE NOT has_deal) AS without_deal
        FROM (
          SELECT EXISTS(SELECT 1 FROM clint_deals d WHERE d.contact_id = c.id) AS has_deal
          FROM clint_contacts c
        ) sub
      `),
      pool.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (won_at - clint_created_at)) / 86400) AS avg_days_to_win
        FROM clint_deals
        WHERE status = 'WON' AND won_at IS NOT NULL AND clint_created_at IS NOT NULL
      `),
      pool.query(`
        SELECT
          COALESCE(o.name, 'Sem origem') AS origin_name,
          COALESCE(d.fields->>'product_name', d.fields->>'produto', '(sem produto)') AS product,
          COUNT(*) AS total,
          COALESCE(SUM(d.value), 0) AS revenue
        FROM clint_deals d
        LEFT JOIN clint_origins o ON o.id = d.origin_id
        WHERE d.status = 'WON'
        GROUP BY 1, 2
        ORDER BY revenue DESC
        LIMIT 15
      `),
    ]);

    const overview = overviewResult.rows[0];

    const origins: OriginRow[] = originsResult.rows.map((r) => ({
      originId: r.origin_id,
      originName: r.origin_name,
      total: Number(r.total),
      won: Number(r.won),
      lost: Number(r.lost),
      open: Number(r.open),
      revenue: Number(r.revenue),
    }));

    const products: ProductRow[] = productsResult.rows.map((r) => ({
      product: r.product,
      total: Number(r.total),
      revenue: Number(r.revenue),
    }));

    const stages: StageRow[] = stagesResult.rows.map((r) => ({
      stage: r.stage,
      stageId: r.stage_id,
      count: Number(r.count),
      value: Number(r.value),
    }));

    const tags: TagRow[] = tagsResult.rows.map((r) => ({ name: r.name, count: Number(r.count) }));

    const fontes = fontesResult.rows.map((r) => ({
      fonte: r.fonte,
      total: Number(r.total),
      won: Number(r.won),
      lost: Number(r.lost),
    }));

    const originProduct = originProductResult.rows.map((r) => ({
      originName: r.origin_name,
      product: r.product,
      total: Number(r.total),
      revenue: Number(r.revenue),
    }));

    const withDealRow = contactsWithDealResult.rows[0];
    const avgDaysToWin = cycleTimeResult.rows[0]?.avg_days_to_win
      ? Number(cycleTimeResult.rows[0].avg_days_to_win)
      : null;

    const insights = buildInsights({ origins, products, avgDaysToWin, overview });

    return NextResponse.json({
      overview: {
        totalContacts: Number(overview.total_contacts),
        totalDeals: Number(overview.total_deals),
        openDeals: Number(overview.open_deals),
        wonDeals: Number(overview.won_deals),
        lostDeals: Number(overview.lost_deals),
        totalRevenue: Number(overview.total_revenue),
        avgTicket: Number(overview.avg_ticket),
        winRate: winRate(Number(overview.won_deals), Number(overview.lost_deals)),
        avgDaysToWin,
        contactsWithDeal: Number(withDealRow.with_deal),
        contactsWithoutDeal: Number(withDealRow.without_deal),
      },
      trends: {
        contactsWeekly: toWeeklySeries(contactsWeeklyResult.rows),
        dealsCreatedWeekly: toWeeklySeries(dealsCreatedWeeklyResult.rows),
        dealsWonWeekly: toWeeklySeries(dealsWonWeeklyResult.rows),
      },
      funnel: stages,
      origins,
      products,
      fontes,
      tags,
      originProductCross: originProduct,
      insights,
    });
  } catch (error) {
    console.error("Erro ao agregar dados da Clint:", error);
    return NextResponse.json({ error: "Erro ao carregar dados do dashboard Clint." }, { status: 500 });
  }
}

function buildInsights({
  origins,
  products,
  avgDaysToWin,
  overview,
}: {
  origins: OriginRow[];
  products: ProductRow[];
  avgDaysToWin: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overview: any;
}): string[] {
  const insights: string[] = [];

  const qualifiedOrigins = origins
    .filter((o) => o.total >= MIN_VOLUME_FOR_RATE)
    .map((o) => ({ ...o, rate: winRate(o.won, o.lost) }))
    .filter((o): o is OriginRow & { rate: number } => o.rate !== null);

  if (qualifiedOrigins.length > 1) {
    const avgRate =
      qualifiedOrigins.reduce((sum, o) => sum + o.rate, 0) / qualifiedOrigins.length;
    const best = [...qualifiedOrigins].sort((a, b) => b.rate - a.rate)[0];
    const worst = [...qualifiedOrigins].sort((a, b) => a.rate - b.rate)[0];

    if (best.rate > avgRate * 1.15) {
      const diff = Math.round(((best.rate - avgRate) / avgRate) * 100);
      insights.push(
        `Origem "${best.originName}" converte ${diff}% acima da média (${Math.round(best.rate * 100)}% vs. ${Math.round(avgRate * 100)}% médio) — vale priorizar investimento aqui.`
      );
    }
    if (worst.rate < avgRate * 0.6 && worst.total >= MIN_VOLUME_FOR_RATE * 2) {
      insights.push(
        `Origem "${worst.originName}" converte bem abaixo da média (${Math.round(worst.rate * 100)}% vs. ${Math.round(avgRate * 100)}%), com volume relevante (${worst.total} negócios) — vale investigar o motivo.`
      );
    }
  }

  if (products.length > 0) {
    const topProduct = products[0];
    insights.push(
      `"${topProduct.product}" é o produto que mais gera receita fechada: R$ ${Math.round(topProduct.revenue).toLocaleString("pt-BR")} em ${topProduct.total} venda(s).`
    );
  }

  if (avgDaysToWin !== null) {
    insights.push(`Ciclo médio de fechamento (criação → ganho): ${Math.round(avgDaysToWin)} dias.`);
  }

  const totalDecided = Number(overview.won_deals) + Number(overview.lost_deals);
  if (totalDecided > 0) {
    const overallRate = Number(overview.won_deals) / totalDecided;
    insights.push(
      `Taxa de conversão geral (ganhos ÷ decididos): ${Math.round(overallRate * 100)}% (${overview.won_deals} ganhos, ${overview.lost_deals} perdidos, ${overview.open_deals} em aberto).`
    );
  }

  return insights;
}
