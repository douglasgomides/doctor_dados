"use client";

import { CampaignRow } from "@/types";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  Eye,
  UserPlus,
  MessageCircle,
  MousePointerClick,
  Target,
  ShoppingCart,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { calcTotals, calcTrend } from "@/lib/metrics";

interface KPICardsV2Props {
  data: CampaignRow[];
  previousData?: CampaignRow[];
}

interface KPIDefV2 {
  label: string;
  value: string;
  icon: typeof DollarSign;
  trend: number | null;
  lowerIsBetter?: boolean;
  accent: string;
  glow: string;
}

export function KPICardsV2({ data, previousData = [] }: KPICardsV2Props) {
  const t = calcTotals(data);
  const prev = calcTotals(previousData);

  const kpis: KPIDefV2[] = [
    {
      label: "Checkouts",
      value: t.checkouts.toLocaleString("pt-BR"),
      icon: ShoppingCart,
      trend: calcTrend(t.checkouts, prev.checkouts),
      accent: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "R$/Checkout",
      value: `R$ ${t.custoPorCheckout.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: calcTrend(t.custoPorCheckout, prev.custoPorCheckout),
      lowerIsBetter: true,
      accent: "from-teal-500 to-cyan-600",
      glow: "shadow-teal-500/10",
    },
    {
      label: "Taxa Conversão Venda",
      value: `${t.taxaConversaoMensagemCheckout.toFixed(1)}%`,
      icon: Percent,
      trend: calcTrend(t.taxaConversaoMensagemCheckout, prev.taxaConversaoMensagemCheckout),
      accent: "from-fuchsia-500 to-pink-600",
      glow: "shadow-fuchsia-500/10",
    },
    {
      label: "Investido",
      value: `R$ ${t.valorInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: calcTrend(t.valorInvestido, prev.valorInvestido),
      accent: "from-blue-500 to-cyan-600",
      glow: "shadow-blue-500/10",
    },
    {
      label: "Impressões",
      value: t.impressoes.toLocaleString("pt-BR"),
      icon: Eye,
      trend: calcTrend(t.impressoes, prev.impressoes),
      accent: "from-sky-500 to-blue-600",
      glow: "shadow-sky-500/10",
    },
    {
      label: "R$/Seguidor",
      value: `R$ ${t.custoPorSeguidorMedio.toFixed(2)}`,
      icon: UserPlus,
      trend: calcTrend(t.custoPorSeguidorMedio, prev.custoPorSeguidorMedio),
      lowerIsBetter: true,
      accent: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/10",
    },
    {
      label: "R$/Mensagem",
      value: `R$ ${t.custoPorMensagemMedio.toFixed(2)}`,
      icon: MessageCircle,
      trend: calcTrend(t.custoPorMensagemMedio, prev.custoPorMensagemMedio),
      lowerIsBetter: true,
      accent: "from-amber-500 to-orange-600",
      glow: "shadow-amber-500/10",
    },
    {
      label: "Cliques no Link",
      value: t.cliquesNoLink.toLocaleString("pt-BR"),
      icon: MousePointerClick,
      trend: calcTrend(t.cliquesNoLink, prev.cliquesNoLink),
      accent: "from-rose-500 to-pink-600",
      glow: "shadow-rose-500/10",
    },
    {
      label: "Cliques Únicos",
      value: t.cliquesUnicos.toLocaleString("pt-BR"),
      icon: Target,
      trend: calcTrend(t.cliquesUnicos, prev.cliquesUnicos),
      accent: "from-cyan-500 to-blue-600",
      glow: "shadow-cyan-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => {
        const isGood =
          kpi.trend === null
            ? null
            : kpi.lowerIsBetter
              ? kpi.trend <= 0
              : kpi.trend >= 0;

        return (
          <div
            key={kpi.label}
            className={cn(
              "group relative rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-4 transition-all duration-300 hover:shadow-lg",
              `hover:${kpi.glow}`
            )}
          >
            {/* Accent line */}
            <div
              className={cn(
                "absolute top-0 left-3 right-3 h-[2px] rounded-b-full bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity",
                kpi.accent
              )}
            />

            {/* Icon */}
            <div
              className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br text-white mb-3",
                kpi.accent
              )}
            >
              <kpi.icon className="h-4 w-4" />
            </div>

            {/* Value */}
            <p className="text-lg font-bold tracking-tight font-mono leading-none mb-1">
              {kpi.value}
            </p>

            {/* Label + Trend */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground font-medium">
                {kpi.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10px] font-bold font-mono",
                  isGood === null
                    ? "text-muted-foreground"
                    : isGood
                      ? "text-emerald-500"
                      : "text-red-500"
                )}
              >
                {isGood === null ? (
                  <Minus className="h-3 w-3" />
                ) : kpi.trend! >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {kpi.trend === null ? "—" : `${Math.abs(kpi.trend).toFixed(1)}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
