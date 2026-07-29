"use client";

import { CampaignRow } from "@/types";
import { rankCampaigns } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface CampaignRankingV2Props {
  data: CampaignRow[];
}

export function CampaignRankingV2({ data }: CampaignRankingV2Props) {
  const ranking = rankCampaigns(data);

  return (
    <div className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Ranking de Campanhas — Onde Escalar</h3>
        <p className="text-[11px] text-muted-foreground">
          Ordenado por taxa de conversão em venda
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium py-2">Campanha</th>
              <th className="text-right font-medium py-2">Investido</th>
              <th className="text-right font-medium py-2">Msgs</th>
              <th className="text-right font-medium py-2">Checkouts</th>
              <th className="text-right font-medium py-2">Conversão</th>
              <th className="text-right font-medium py-2">R$/Checkout</th>
              <th className="text-right font-medium py-2">Ação</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((c, i) => {
              const isTopPerformer = c.checkouts > 0 && i < 3;
              const isUnderperformer = c.checkouts === 0 && c.mensagensIniciadas > 0;

              return (
                <tr key={c.campanha} className="border-t border-border/30">
                  <td className="py-2 pr-2 max-w-[200px] truncate font-medium">
                    {c.campanha}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    R$ {c.valorInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {c.mensagensIniciadas.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 text-right font-mono font-bold tabular-nums">
                    {c.checkouts.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {c.mensagensIniciadas > 0 ? `${c.taxaConversao.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {c.checkouts > 0
                      ? `R$ ${c.custoPorCheckout.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {isTopPerformer && (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5">
                        Escalar
                      </span>
                    )}
                    {isUnderperformer && (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5">
                        Revisar
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {ranking.length === 0 && (
              <tr>
                <td colSpan={7} className={cn("py-6 text-center text-muted-foreground")}>
                  Sem dados para o período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
