import { CampaignRow } from "@/types";

// ============================================
// INTELIGÊNCIA COMERCIAL - Métricas de funil e fechamento
// ============================================

export interface CommercialTotals {
  valorInvestido: number;
  impressoes: number;
  cliquesNoLink: number;
  cliquesUnicos: number;
  mensagensIniciadas: number;
  checkouts: number;
  seguidoresNovos: number;
  custoPorSeguidorMedio: number;
  custoPorMensagemMedio: number;
  custoPorCheckout: number;
  taxaConversaoMensagemCheckout: number; // checkouts / mensagensIniciadas
  taxaConversaoCliqueMensagem: number; // mensagensIniciadas / cliquesUnicos
}

export function calcTotals(data: CampaignRow[]): CommercialTotals {
  const valorInvestido = data.reduce((s, r) => s + r.valorInvestido, 0);
  const impressoes = data.reduce((s, r) => s + r.impressoes, 0);
  const cliquesNoLink = data.reduce((s, r) => s + r.cliquesNoLink, 0);
  const cliquesUnicos = data.reduce((s, r) => s + r.cliquesUnicos, 0);
  const mensagensIniciadas = data.reduce((s, r) => s + r.mensagensIniciadas, 0);
  const checkouts = data.reduce((s, r) => s + r.checkouts, 0);
  const seguidoresNovos = data.reduce((s, r) => s + r.seguidoresNovos, 0);

  const custosPorSeguidor = data.filter((r) => r.custoPorSeguidor > 0);
  const custoPorSeguidorMedio =
    custosPorSeguidor.length > 0
      ? custosPorSeguidor.reduce((s, r) => s + r.custoPorSeguidor, 0) / custosPorSeguidor.length
      : 0;

  const custosPorMensagem = data.filter((r) => r.custoPorMensagem > 0);
  const custoPorMensagemMedio =
    custosPorMensagem.length > 0
      ? custosPorMensagem.reduce((s, r) => s + r.custoPorMensagem, 0) / custosPorMensagem.length
      : 0;

  return {
    valorInvestido,
    impressoes,
    cliquesNoLink,
    cliquesUnicos,
    mensagensIniciadas,
    checkouts,
    seguidoresNovos,
    custoPorSeguidorMedio,
    custoPorMensagemMedio,
    custoPorCheckout: checkouts > 0 ? valorInvestido / checkouts : 0,
    taxaConversaoMensagemCheckout:
      mensagensIniciadas > 0 ? (checkouts / mensagensIniciadas) * 100 : 0,
    taxaConversaoCliqueMensagem:
      cliquesUnicos > 0 ? (mensagensIniciadas / cliquesUnicos) * 100 : 0,
  };
}

// Variação percentual entre período atual e período anterior
export function calcTrend(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // sem base de comparação
  return ((current - previous) / previous) * 100;
}

export interface CampaignPerformance {
  campanha: string;
  contaDeAnuncio: string;
  valorInvestido: number;
  mensagensIniciadas: number;
  checkouts: number;
  taxaConversao: number; // checkouts / mensagensIniciadas, %
  custoPorCheckout: number; // valorInvestido / checkouts
}

// Ranking de campanhas por eficiência de fechamento — orienta onde investir mais
export function rankCampaigns(data: CampaignRow[]): CampaignPerformance[] {
  const byCampaign = new Map<string, CampaignPerformance>();

  for (const row of data) {
    const existing = byCampaign.get(row.nomeDaCampanha);
    if (existing) {
      existing.valorInvestido += row.valorInvestido;
      existing.mensagensIniciadas += row.mensagensIniciadas;
      existing.checkouts += row.checkouts;
    } else {
      byCampaign.set(row.nomeDaCampanha, {
        campanha: row.nomeDaCampanha,
        contaDeAnuncio: row.contaDeAnuncio,
        valorInvestido: row.valorInvestido,
        mensagensIniciadas: row.mensagensIniciadas,
        checkouts: row.checkouts,
        taxaConversao: 0,
        custoPorCheckout: 0,
      });
    }
  }

  const result = Array.from(byCampaign.values()).map((c) => ({
    ...c,
    taxaConversao: c.mensagensIniciadas > 0 ? (c.checkouts / c.mensagensIniciadas) * 100 : 0,
    custoPorCheckout: c.checkouts > 0 ? c.valorInvestido / c.checkouts : 0,
  }));

  // Prioriza quem já fechou venda, ordenando pela taxa de conversão
  result.sort((a, b) => {
    if (a.checkouts === 0 && b.checkouts === 0) return b.valorInvestido - a.valorInvestido;
    if (a.checkouts === 0) return 1;
    if (b.checkouts === 0) return -1;
    return b.taxaConversao - a.taxaConversao;
  });

  return result;
}

export interface FunnelStage {
  label: string;
  value: number;
  conversionFromPrevious: number | null; // % em relação à etapa anterior
}

// Funil comercial: quem viu -> quem clicou -> quem conversou -> quem fechou
export function buildFunnel(totals: CommercialTotals): FunnelStage[] {
  const stages: FunnelStage[] = [
    { label: "Impressões", value: totals.impressoes, conversionFromPrevious: null },
    {
      label: "Cliques Únicos",
      value: totals.cliquesUnicos,
      conversionFromPrevious:
        totals.impressoes > 0 ? (totals.cliquesUnicos / totals.impressoes) * 100 : null,
    },
    {
      label: "Mensagens Iniciadas",
      value: totals.mensagensIniciadas,
      conversionFromPrevious:
        totals.cliquesUnicos > 0
          ? (totals.mensagensIniciadas / totals.cliquesUnicos) * 100
          : null,
    },
    {
      label: "Checkouts (Fechamento)",
      value: totals.checkouts,
      conversionFromPrevious:
        totals.mensagensIniciadas > 0
          ? (totals.checkouts / totals.mensagensIniciadas) * 100
          : null,
    },
  ];
  return stages;
}
