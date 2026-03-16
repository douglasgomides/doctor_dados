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
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardsProps {
  data: CampaignRow[];
}

export function KPICards({ data }: KPICardsProps) {
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
      title: "Valor Total Investido",
      value: `R$ ${totalInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: "+12.5%",
      trendUp: true,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      title: "Total de Impressões",
      value: totalImpressoes.toLocaleString("pt-BR"),
      icon: Eye,
      trend: "+8.2%",
      trendUp: true,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Custo por Seguidor Médio",
      value: `R$ ${avgCustoPorSeguidor.toFixed(2)}`,
      icon: UserPlus,
      trend: "-3.1%",
      trendUp: false,
      color: "text-violet-600 dark:text-violet-400",
      bgColor: "bg-violet-50 dark:bg-violet-950/30",
    },
    {
      title: "Custo por Mensagem Médio",
      value: `R$ ${avgCustoPorMensagem.toFixed(2)}`,
      icon: MessageCircle,
      trend: "-1.8%",
      trendUp: false,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      title: "Cliques no Link",
      value: totalCliquesNoLink.toLocaleString("pt-BR"),
      icon: MousePointerClick,
      trend: "+5.4%",
      trendUp: true,
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-50 dark:bg-rose-950/30",
    },
    {
      title: "Cliques Únicos",
      value: totalCliquesUnicos.toLocaleString("pt-BR"),
      icon: Target,
      trend: "+4.7%",
      trendUp: true,
      color: "text-cyan-600 dark:text-cyan-400",
      bgColor: "bg-cyan-50 dark:bg-cyan-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi) => (
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
              {kpi.trendUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span className="text-xs font-medium text-emerald-500">
                {kpi.trend}
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                vs. período anterior
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
