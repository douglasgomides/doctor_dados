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

    const contactsWeekly = toWeeklySeries(contactsWeeklyResult.rows);
    const dealsCreatedWeekly = toWeeklySeries(dealsCreatedWeeklyResult.rows);
    const dealsWonWeekly = toWeeklySeries(dealsWonWeeklyResult.rows);

    const insightSections = buildInsightSections({
      origins,
      products,
      fontes,
      avgDaysToWin,
      overview,
      contactsWeekly,
      dealsCreatedWeekly,
      dealsWonWeekly,
      contactsWithoutDeal: Number(withDealRow.without_deal),
    });

    const actions = buildActions({
      origins,
      products,
      overview,
      contactsWithoutDeal: Number(withDealRow.without_deal),
      avgDaysToWin,
    });

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
      trends: { contactsWeekly, dealsCreatedWeekly, dealsWonWeekly },
      funnel: stages,
      origins,
      products,
      fontes,
      tags,
      originProductCross: originProduct,
      insightSections,
      actions,
    });
  } catch (error) {
    console.error("Erro ao agregar dados da Clint:", error);
    return NextResponse.json({ error: "Erro ao carregar dados do dashboard Clint." }, { status: 500 });
  }
}

function qualifyByRate<T extends { total: number; won: number; lost: number }>(
  rows: T[]
): (T & { rate: number })[] {
  return rows
    .filter((r) => r.total >= MIN_VOLUME_FOR_RATE)
    .map((r) => ({ ...r, rate: winRate(r.won, r.lost) }))
    .filter((r): r is T & { rate: number } => r.rate !== null);
}

function weekDelta(series: WeeklyPoint[]): { current: number; previous: number; pct: number | null } | null {
  if (series.length < 2) return null;
  const current = series[series.length - 1].count;
  const previous = series[series.length - 2].count;
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
  return { current, previous, pct };
}

interface InsightSection {
  title: string;
  items: string[];
}

function buildInsightSections({
  origins,
  products,
  fontes,
  avgDaysToWin,
  overview,
  contactsWeekly,
  dealsCreatedWeekly,
  dealsWonWeekly,
  contactsWithoutDeal,
}: {
  origins: OriginRow[];
  products: ProductRow[];
  fontes: { fonte: string; total: number; won: number; lost: number }[];
  avgDaysToWin: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overview: any;
  contactsWeekly: WeeklyPoint[];
  dealsCreatedWeekly: WeeklyPoint[];
  dealsWonWeekly: WeeklyPoint[];
  contactsWithoutDeal: number;
}): InsightSection[] {
  const sections: InsightSection[] = [];

  // --- Origem: quem converte melhor e pior ---
  const qualifiedOrigins = qualifyByRate(origins);
  if (qualifiedOrigins.length > 1) {
    const avgRate = qualifiedOrigins.reduce((sum, o) => sum + o.rate, 0) / qualifiedOrigins.length;
    const sorted = [...qualifiedOrigins].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const items: string[] = [];

    items.push(
      `"${best.originName}" é a origem que mais converte: ${Math.round(best.rate * 100)}% (${best.won} ganhos de ${best.won + best.lost} decididos), gerando ${formatBRLServer(best.revenue)} em receita.`
    );
    if (worst.rate < avgRate * 0.6 && worst.originName !== best.originName) {
      items.push(
        `"${worst.originName}" converte bem abaixo da média (${Math.round(worst.rate * 100)}% vs. ${Math.round(avgRate * 100)}% médio), com volume relevante (${worst.total} negócios) — vale entender o motivo antes de investir mais aqui.`
      );
    }
    const byVolume = [...origins].sort((a, b) => b.total - a.total)[0];
    if (byVolume && byVolume.originName !== best.originName) {
      items.push(
        `"${byVolume.originName}" é a origem com mais volume (${byVolume.total} negócios), mas não é a que mais converte — pode valer revisar a qualificação desses leads.`
      );
    }
    sections.push({ title: "Origem que mais converte", items });
  }

  // --- Canal/fonte mais quente ---
  const qualifiedFontes = qualifyByRate(fontes.map((f) => ({ ...f })));
  if (qualifiedFontes.length > 0) {
    const bestFonte = [...qualifiedFontes].sort((a, b) => b.rate - a.rate)[0];
    sections.push({
      title: "Canal de captação mais quente",
      items: [
        `"${bestFonte.fonte}" é o canal com melhor taxa de fechamento entre os que têm volume relevante: ${Math.round(bestFonte.rate * 100)}% (${bestFonte.won} de ${bestFonte.won + bestFonte.lost} decididos).`,
      ],
    });
  }

  // --- Produtos ---
  if (products.length > 0) {
    const items = [
      `"${products[0].product}" é o produto que mais gera receita: ${formatBRLServer(products[0].revenue)} em ${products[0].total} venda(s).`,
    ];
    if (products.length > 1) {
      items.push(
        `Em seguida vem "${products[1].product}", com ${formatBRLServer(products[1].revenue)} em ${products[1].total} venda(s).`
      );
    }
    sections.push({ title: "Produtos que mais vendem", items });
  }

  // --- Tendência semanal ---
  const contactsDelta = weekDelta(contactsWeekly);
  const dealsDelta = weekDelta(dealsCreatedWeekly);
  const wonDelta = weekDelta(dealsWonWeekly);
  const trendItems: string[] = [];
  if (contactsDelta && contactsDelta.pct !== null) {
    trendItems.push(
      `Contatos novos: ${contactsDelta.current} essa semana (${contactsDelta.pct >= 0 ? "+" : ""}${contactsDelta.pct}% vs. semana anterior).`
    );
  }
  if (dealsDelta && dealsDelta.pct !== null) {
    trendItems.push(
      `Negócios criados: ${dealsDelta.current} essa semana (${dealsDelta.pct >= 0 ? "+" : ""}${dealsDelta.pct}% vs. semana anterior).`
    );
  }
  if (wonDelta && wonDelta.pct !== null) {
    trendItems.push(
      `Negócios ganhos: ${wonDelta.current} essa semana (${wonDelta.pct >= 0 ? "+" : ""}${wonDelta.pct}% vs. semana anterior).`
    );
  }
  if (trendItems.length > 0) sections.push({ title: "Tendência da semana", items: trendItems });

  // --- Ciclo e pontos de atenção ---
  const attentionItems: string[] = [];
  if (avgDaysToWin !== null) {
    attentionItems.push(`Ciclo médio de fechamento (criação → ganho): ${Math.round(avgDaysToWin)} dias.`);
  }
  const totalContacts = Number(overview.total_contacts);
  if (totalContacts > 0) {
    const pctSemNegocio = Math.round((contactsWithoutDeal / totalContacts) * 100);
    if (pctSemNegocio > 50) {
      attentionItems.push(
        `${pctSemNegocio}% dos contatos (${contactsWithoutDeal.toLocaleString("pt-BR")}) nunca tiveram um negócio criado — base grande sem oportunidade comercial associada.`
      );
    }
  }
  if (attentionItems.length > 0) sections.push({ title: "Pontos de atenção", items: attentionItems });

  return sections;
}

interface ActionItem {
  titulo: string;
  porque: string;
  oque: string;
  impacto: "Alto" | "Médio" | "Baixo";
  prazo: string;
}

function buildActions({
  origins,
  products,
  overview,
  contactsWithoutDeal,
  avgDaysToWin,
}: {
  origins: OriginRow[];
  products: ProductRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overview: any;
  contactsWithoutDeal: number;
  avgDaysToWin: number | null;
}): ActionItem[] {
  const actions: ActionItem[] = [];
  const qualifiedOrigins = qualifyByRate(origins);

  if (qualifiedOrigins.length > 1) {
    const avgRate = qualifiedOrigins.reduce((sum, o) => sum + o.rate, 0) / qualifiedOrigins.length;
    const sorted = [...qualifiedOrigins].sort((a, b) => b.rate - a.rate);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best.rate > avgRate * 1.15) {
      actions.push({
        titulo: `Priorizar investimento em "${best.originName}"`,
        porque: `Converte ${Math.round(best.rate * 100)}%, acima da média de ${Math.round(avgRate * 100)}%, com ${best.total} negócios já gerados.`,
        oque: "Aumentar o volume de leads dessa origem (orçamento de anúncio, conteúdo, ou esforço de captação) mantendo a mesma qualificação de entrada.",
        impacto: "Alto",
        prazo: "Esta semana",
      });
    }
    if (worst.rate < avgRate * 0.6 && worst.total >= MIN_VOLUME_FOR_RATE * 2) {
      actions.push({
        titulo: `Investigar baixa conversão em "${worst.originName}"`,
        porque: `Converte só ${Math.round(worst.rate * 100)}% (vs. ${Math.round(avgRate * 100)}% médio), mas já tem ${worst.total} negócios — volume relevante sendo desperdiçado.`,
        oque: "Revisar o processo de qualificação e atendimento inicial desses leads antes de continuar investindo nessa origem no mesmo ritmo.",
        impacto: "Médio",
        prazo: "Próximas 2 semanas",
      });
    }
  }

  if (products.length > 0) {
    actions.push({
      titulo: `Reforçar oferta de "${products[0].product}"`,
      porque: `É o produto que mais gera receita (${formatBRLServer(products[0].revenue)} em ${products[0].total} venda(s)) — ainda tem espaço pra crescer se aparecer mais nas conversas comerciais.`,
      oque: "Garantir que o time comercial mencione essa oferta primeiro em conversas com leads qualificados, e priorizar conteúdo/anúncio sobre ela.",
      impacto: "Alto",
      prazo: "Este mês",
    });
  }

  const totalContacts = Number(overview.total_contacts);
  if (totalContacts > 0 && contactsWithoutDeal / totalContacts > 0.5) {
    actions.push({
      titulo: "Criar campanha de reengajamento da base",
      porque: `${contactsWithoutDeal.toLocaleString("pt-BR")} contatos (mais da metade da base) nunca tiveram um negócio aberto.`,
      oque: "Segmentar essa base por tag/origem e disparar uma campanha de reativação (WhatsApp ou e-mail) oferecendo o produto de entrada.",
      impacto: "Médio",
      prazo: "Este mês",
    });
  }

  if (avgDaysToWin !== null && avgDaysToWin > 14) {
    actions.push({
      titulo: "Encurtar o ciclo de fechamento",
      porque: `O ciclo médio hoje é de ${Math.round(avgDaysToWin)} dias entre a criação do negócio e o fechamento — quanto mais longo, maior a chance de o lead esfriar.`,
      oque: "Mapear em qual etapa do funil os negócios mais demoram e criar um gatilho de follow-up automático pra essa etapa específica.",
      impacto: "Médio",
      prazo: "Próximas 2 semanas",
    });
  }

  return actions;
}

function formatBRLServer(value: number): string {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}
