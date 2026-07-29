"use client";

import { CampaignRow } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calcTotals, buildFunnel } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface ConversionFunnelProps {
  data: CampaignRow[];
}

const STAGE_COLORS = [
  "bg-sky-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
];

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const totals = calcTotals(data);
  const stages = buildFunnel(totals);
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Funil de Conversão em Vendas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          De impressão até fechamento — onde o funil está perdendo oportunidade
        </p>
      </CardHeader>
      <CardContent className="pt-2 space-y-4">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.value / maxValue) * 100, 4);
          return (
            <div key={stage.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{stage.label}</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold tabular-nums">
                    {stage.value.toLocaleString("pt-BR")}
                  </span>
                  {stage.conversionFromPrevious !== null && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ({stage.conversionFromPrevious.toFixed(1)}% da etapa anterior)
                    </span>
                  )}
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", STAGE_COLORS[i])}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="pt-2 mt-2 border-t border-border/50 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Conversão geral (impressão → fechamento)</span>
          <span className="font-semibold">
            {totals.impressoes > 0
              ? `${((totals.checkouts / totals.impressoes) * 100).toFixed(3)}%`
              : "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
