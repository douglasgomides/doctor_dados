"use client";

import { CampaignRow } from "@/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { rankCampaigns } from "@/lib/metrics";
import { TrendingUp } from "lucide-react";

interface CampaignRankingProps {
  data: CampaignRow[];
}

export function CampaignRanking({ data }: CampaignRankingProps) {
  const ranking = rankCampaigns(data);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">
            Ranking de Campanhas — Onde Escalar
          </CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Ordenado por taxa de conversão em venda. Escale o que fecha mais, revise o que não fecha.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Mensagens</TableHead>
              <TableHead className="text-right">Checkouts</TableHead>
              <TableHead className="text-right">Conversão</TableHead>
              <TableHead className="text-right">Custo/Checkout</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ranking.map((c, i) => {
              const isTopPerformer = c.checkouts > 0 && i < 3;
              const isUnderperformer = c.checkouts === 0 && c.mensagensIniciadas > 0;

              return (
                <TableRow key={c.campanha}>
                  <TableCell className="font-medium max-w-[220px] truncate">
                    {c.campanha}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    R$ {c.valorInvestido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.mensagensIniciadas.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {c.checkouts.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.mensagensIniciadas > 0 ? `${c.taxaConversao.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.checkouts > 0
                      ? `R$ ${c.custoPorCheckout.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {isTopPerformer && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                        Escalar
                      </Badge>
                    )}
                    {isUnderperformer && (
                      <Badge variant="destructive" className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                        Revisar
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {ranking.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Sem dados para o período selecionado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
