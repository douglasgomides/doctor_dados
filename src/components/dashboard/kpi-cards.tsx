"use client";

import { CampaignRow } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  Eye,
  UserPlus,
  MessageCircle,
  MousePointerClick,
  Target,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calcTotals, calcTrend } from "@/lib/metrics";

interface KPICardsProps {
  data: CampaignRow[];
  previousData?: CampaignRow[];
}

interface KPIDefinition {
  title: string;
  value: string;
  icon: typeof DollarSign;
  trend: number | null;
  // Para métricas de custo, uma queda é positiva; para as demais, uma alta é positiva.
  lowerIsBetter?: boolean;
  color: string;
  bgColor: string;
}

function formatTrend(trend: number | null) {
  if (trend === null) return "sem base";
  const sign = trend > 0 ? "+" : "";
  return `${sign}${trend.toFixed(1)}%`;
}

export function KPICards({ data, previousData = [] }: KPICardsProps) {
  const t = calcTotals(data);
  const prev = calcTotals(previousData);

  const kpis: KPIDefinition[] = [
    {
      title: "Checkouts (Vendas Fechadas)",
      value: t.checkouts.toLocaleString("pt-BR"),
      icon: ShoppingCart,
      trend: calcTrend(t.checkouts, prev.checkouts),
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Custo por Checkout",
      value: `R$ ${t.custoPorCheckout.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: calcTrend(t.custoPorCheckout, prev.custoPorCheckout),
      lowerIsBetter: true,
      color: "text-teal-600 dark:text-teal-400",
      bgColor: "bg-teal-50 dark:bg-teal-950/30",
    },
    {
      title: "Taxa de Conversão em Venda",
      value: `${t.taxaConversaoMensagemCheckout.toFixed(1)}%`,
      icon: Percent,
      trend: calcTrend(t.taxaConversaoMensagemCheckout, prev.taxaConversaoMensagemCheckout),
      color: "text-fuchsia-600 dark:text-fuchsia-400",
      bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950/30",
    },
    {
      title: "Valor Total Investido",
      value: `R$ ${t.valorInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: calcTrend(t.valorInvestido, prev.valorInvestido),
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Total de Impressões",
      value: t.impressoes.toLocaleString("pt-BR"),
      icon: Eye,
      trend: calcTrend(t.impressoes, prev.impressoes),
      color: "text-sky-600 dark:text-sky-400",
      bgColor: "bg-sky-50 dark:bg-sky-950/30",
    },
    {
      title: "Custo por Seguidor Médio",
      value: `R$ ${t.custoPorSeguidorMedio.toFixed(2)}`,
      icon: UserPlus,
      trend: calcTrend(t.custoPorSeguidorMedio, prev.custoPorSeguidorMedio),
      lowerIsBetter: true,
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      title: "Custo por Mensagem Médio",
      value: `R$ ${t.custoPorMensagemMedio.toFixed(2)}`,
      icon: MessageCircle,
      trend: calcTrend(t.custoPorMensagemMedio, prev.custoPorMensagemMedio),
      lowerIsBetter: true,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Cliques no Link",
      value: t.cliquesNoLink.toLocaleString("pt-BR"),
      icon: MousePointerClick,
      trend: calcTrend(t.cliquesNoLink, prev.cliquesNoLink),
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
    },
    {
      title: "Cliques Únicos",
      value: t.cliquesUnicos.toLocaleString("pt-BR"),
      icon: Target,
      trend: calcTrend(t.cliquesUnicos, prev.cliquesUnicos),
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => {
        const isGood =
          kpi.trend === null
            ? null
            : kpi.lowerIsBetter
              ? kpi.trend <= 0
              : kpi.trend >= 0;

        return (
          <Card key={kpi.title} className="border-border/50">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                </div>
                <div className={cn("p-2.5 rounded-xl", kpi.bgColor)}>
                  <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3">
                {isGood === null ? null : isGood ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isGood === null
                      ? "text-muted-foreground"
                      : isGood
                        ? "text-emerald-500"
                        : "text-red-500"
                  )}
                >
                  {formatTrend(kpi.trend)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  vs. período anterior
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
