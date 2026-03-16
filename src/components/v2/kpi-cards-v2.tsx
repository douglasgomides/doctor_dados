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
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface KPICardsV2Props {
  data: CampaignRow[];
}

export function KPICardsV2({ data }: KPICardsV2Props) {
  const totalInvestido = data.reduce((sum, r) => sum + r.valorInvestido, 0);
  const totalImpressoes = data.reduce((sum, r) => sum + r.impressoes, 0);

  const custosPorSeguidor = data.filter((r) => r.custoPorSeguidor > 0);
  const avgCustoPorSeguidor =
    custosPorSeguidor.length > 0
      ? custosPorSeguidor.reduce((sum, r) => sum + r.custoPorSeguidor, 0) /
        custosPorSeguidor.length
      : 0;

  const custosPorMensagem = data.filter((r) => r.custoPorMensagem > 0);
  const avgCustoPorMensagem =
    custosPorMensagem.length > 0
      ? custosPorMensagem.reduce((sum, r) => sum + r.custoPorMensagem, 0) /
        custosPorMensagem.length
      : 0;

  const totalCliquesNoLink = data.reduce((sum, r) => sum + r.cliquesNoLink, 0);
  const totalCliquesUnicos = data.reduce((sum, r) => sum + r.cliquesUnicos, 0);

  const kpis = [
    {
      label: "Investido",
      value: `R$ ${totalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: 12.5,
      accent: "from-emerald-500 to-teal-600",
      glow: "shadow-emerald-500/10",
    },
    {
      label: "Impressões",
      value: totalImpressoes.toLocaleString("pt-BR"),
      icon: Eye,
      trend: 8.2,
      accent: "from-blue-500 to-cyan-600",
      glow: "shadow-blue-500/10",
    },
    {
      label: "R$/Seguidor",
      value: `R$ ${avgCustoPorSeguidor.toFixed(2)}`,
      icon: UserPlus,
      trend: -3.1,
      accent: "from-violet-500 to-purple-600",
      glow: "shadow-violet-500/10",
    },
    {
      label: "R$/Mensagem",
      value: `R$ ${avgCustoPorMensagem.toFixed(2)}`,
      icon: MessageCircle,
      trend: -1.8,
      accent: "from-amber-500 to-orange-600",
      glow: "shadow-amber-500/10",
    },
    {
      label: "Cliques no Link",
      value: totalCliquesNoLink.toLocaleString("pt-BR"),
      icon: MousePointerClick,
      trend: 5.4,
      accent: "from-rose-500 to-pink-600",
      glow: "shadow-rose-500/10",
    },
    {
      label: "Cliques Únicos",
      value: totalCliquesUnicos.toLocaleString("pt-BR"),
      icon: Target,
      trend: 4.7,
      accent: "from-cyan-500 to-blue-600",
      glow: "shadow-cyan-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
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
                kpi.trend > 0 ? "text-emerald-500" : "text-emerald-500"
              )}
            >
              {kpi.trend > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(kpi.trend)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
