"use client";

import { CampaignRow } from "@/types";
import { calcTotals, buildFunnel } from "@/lib/metrics";

interface ConversionFunnelV2Props {
  data: CampaignRow[];
}

const STAGE_GRADIENTS = [
  "from-sky-500 to-blue-600",
  "from-blue-500 to-violet-600",
  "from-violet-500 to-fuchsia-600",
  "from-emerald-500 to-teal-600",
];

export function ConversionFunnelV2({ data }: ConversionFunnelV2Props) {
  const totals = calcTotals(data);
  const stages = buildFunnel(totals);
  const maxValue = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Funil de Conversão em Vendas</h3>
        <p className="text-[11px] text-muted-foreground">
          De impressão até fechamento
        </p>
      </div>

      <div className="space-y-4">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.value / maxValue) * 100, 4);
          return (
            <div key={stage.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {stage.label}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold font-mono tabular-nums">
                    {stage.value.toLocaleString("pt-BR")}
                  </span>
                  {stage.conversionFromPrevious !== null && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {stage.conversionFromPrevious.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${STAGE_GRADIENTS[i]} transition-all`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-3 mt-3 border-t border-border/40 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Conversão geral (impressão → fechamento)
        </span>
        <span className="text-sm font-bold font-mono">
          {totals.impressoes > 0
            ? `${((totals.checkouts / totals.impressoes) * 100).toFixed(3)}%`
            : "—"}
        </span>
      </div>
    </div>
  );
}
