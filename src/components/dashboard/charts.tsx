"use client";

import { CampaignRow } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartsProps {
  data: CampaignRow[];
}

export function Charts({ data }: ChartsProps) {
  // Agrupar por dia para gráfico de linhas (Impressões vs Alcance)
  const dailyData = data.reduce(
    (acc, row) => {
      const existing = acc.find((d) => d.dia === row.dia);
      if (existing) {
        existing.impressoes += row.impressoes;
        existing.alcance += row.alcance;
      } else {
        acc.push({
          dia: row.dia,
          diaLabel: new Date(row.dia + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          impressoes: row.impressoes,
          alcance: row.alcance,
        });
      }
      return acc;
    },
    [] as { dia: string; diaLabel: string; impressoes: number; alcance: number }[]
  );

  dailyData.sort((a, b) => a.dia.localeCompare(b.dia));

  // Agrupar por campanha para gráfico de barras (Valor Investido)
  const campaignData = data.reduce(
    (acc, row) => {
      const existing = acc.find((d) => d.campanha === row.nomeDaCampanha);
      if (existing) {
        existing.valorInvestido += row.valorInvestido;
      } else {
        acc.push({
          campanha: row.nomeDaCampanha,
          campanhaShort:
            row.nomeDaCampanha.length > 18
              ? row.nomeDaCampanha.substring(0, 18) + "..."
              : row.nomeDaCampanha,
          valorInvestido: row.valorInvestido,
        });
      }
      return acc;
    },
    [] as { campanha: string; campanhaShort: string; valorInvestido: number }[]
  );

  campaignData.sort((a, b) => b.valorInvestido - a.valorInvestido);

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Gráfico de Linhas - Impressões vs Alcance */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Impressões vs Alcance
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Evolução diária ao longo do período
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="diaLabel"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={formatNumber}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatNumber(Number(value)),
                    name === "impressoes" ? "Impressões" : "Alcance",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === "impressoes" ? "Impressões" : "Alcance"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="impressoes"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="alcance"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Investimento por Campanha */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Investimento por Campanha
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Total investido por nome da campanha
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignData} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="opacity-30"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="campanhaShort"
                  width={140}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Investido"]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--popover)",
                    color: "var(--popover-foreground)",
                  }}
                />
                <Bar
                  dataKey="valorInvestido"
                  fill="var(--color-chart-1)"
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
