"use client";

import { CampaignRow } from "@/types";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ChartsV2Props {
  data: CampaignRow[];
}

const GRADIENT_COLORS = [
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

export function ChartsV2({ data }: ChartsV2Props) {
  // Agrupar por dia
  const dailyData = data.reduce(
    (acc, row) => {
      const existing = acc.find((d) => d.dia === row.dia);
      if (existing) {
        existing.impressoes += row.impressoes;
        existing.alcance += row.alcance;
      } else {
        acc.push({
          dia: row.dia,
          label: new Date(row.dia + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          }),
          impressoes: row.impressoes,
          alcance: row.alcance,
        });
      }
      return acc;
    },
    [] as { dia: string; label: string; impressoes: number; alcance: number }[]
  );
  dailyData.sort((a, b) => a.dia.localeCompare(b.dia));

  // Agrupar por campanha
  const campaignData = data.reduce(
    (acc, row) => {
      const existing = acc.find((d) => d.campanha === row.nomeDaCampanha);
      if (existing) {
        existing.valor += row.valorInvestido;
      } else {
        acc.push({
          campanha: row.nomeDaCampanha,
          short:
            row.nomeDaCampanha.length > 16
              ? row.nomeDaCampanha.substring(0, 16) + "…"
              : row.nomeDaCampanha,
          valor: row.valorInvestido,
        });
      }
      return acc;
    },
    [] as { campanha: string; short: string; valor: number }[]
  );
  campaignData.sort((a, b) => b.valor - a.valor);

  const formatK = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
    return v.toString();
  };

  const formatBRL = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const tooltipStyle = {
    borderRadius: "10px",
    border: "1px solid var(--border)",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Area Chart - Impressões vs Alcance (3 cols) */}
      <div className="lg:col-span-3 rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-semibold">Impressões vs Alcance</h3>
            <p className="text-[11px] text-muted-foreground">Evolução diária</p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              Impressões
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
              Alcance
            </span>
          </div>
        </div>
        <div className="h-[280px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="gradImpressoes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAlcance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                className="opacity-20"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatK}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip
                formatter={(value, name) => [
                  formatK(Number(value)),
                  name === "impressoes" ? "Impressões" : "Alcance",
                ]}
                contentStyle={tooltipStyle}
              />
              <Area
                type="monotone"
                dataKey="impressoes"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#gradImpressoes)"
              />
              <Area
                type="monotone"
                dataKey="alcance"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#gradAlcance)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart - Investimento por Campanha (2 cols) */}
      <div className="lg:col-span-2 rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
        <div className="mb-1">
          <h3 className="text-sm font-semibold">Investimento por Campanha</h3>
          <p className="text-[11px] text-muted-foreground">Ranking de investimento</p>
        </div>
        <div className="h-[280px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={campaignData} layout="vertical" barCategoryGap="20%">
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                className="opacity-20"
              />
              <XAxis
                type="number"
                tickFormatter={formatBRL}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="short"
                width={120}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(value) => [formatBRL(Number(value)), "Investido"]}
                contentStyle={tooltipStyle}
              />
              <Bar dataKey="valor" radius={[0, 6, 6, 0]} barSize={20}>
                {campaignData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={GRADIENT_COLORS[index % GRADIENT_COLORS.length]}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
