"use client";

import { useEffect, useMemo } from "react";
import {
  useClintStore,
  ClintOriginRow,
  ClintProductRow,
  ClintWeeklyPoint,
} from "@/store/clint-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Sparkles,
  Users2,
  Handshake,
  TrendingUp,
  Wallet,
  Timer,
  Target,
  Lightbulb,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

/** Barra horizontal simples pra rankings (origem, produto, tag) — sem dependência de um componente Progress. */
function RankBar({
  label,
  value,
  maxValue,
  detail,
}: {
  label: string;
  value: number;
  maxValue: number;
  detail?: string;
}) {
  const pct = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="font-medium truncate">{label}</span>
        <span className="text-muted-foreground text-xs shrink-0">{detail ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-5 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
        <Lightbulb className="h-4 w-4" />
        Insights automáticos
      </div>
      <ul className="space-y-2">
        {insights.map((insight, i) => (
          <li key={i} className="text-sm flex items-start gap-2">
            <span className="text-primary shrink-0">•</span>
            <span>{insight}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyTrendChart({
  contacts,
  dealsCreated,
  dealsWon,
}: {
  contacts: ClintWeeklyPoint[];
  dealsCreated: ClintWeeklyPoint[];
  dealsWon: ClintWeeklyPoint[];
}) {
  const merged = useMemo(() => {
    const weeks = new Set<string>();
    [contacts, dealsCreated, dealsWon].forEach((series) => series.forEach((p) => weeks.add(p.week)));
    const sortedWeeks = Array.from(weeks).sort();
    const contactsMap = new Map(contacts.map((p) => [p.week, p.count]));
    const createdMap = new Map(dealsCreated.map((p) => [p.week, p.count]));
    const wonMap = new Map(dealsWon.map((p) => [p.week, p.count]));
    return sortedWeeks.map((week) => ({
      week: formatWeek(week),
      contatos: contactsMap.get(week) || 0,
      negocios: createdMap.get(week) || 0,
      ganhos: wonMap.get(week) || 0,
    }));
  }, [contacts, dealsCreated, dealsWon]);

  if (merged.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
        Tendência semanal
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="clint-contatos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clint-negocios" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clint-ganhos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a9c6d" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1a9c6d" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              contentStyle={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="contatos"
              name="Contatos novos"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="url(#clint-contatos)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="negocios"
              name="Negócios criados"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#clint-negocios)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="ganhos"
              name="Negócios ganhos"
              stroke="#1a9c6d"
              strokeWidth={2}
              fill="url(#clint-ganhos)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" /> Contatos novos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#6366f1]" /> Negócios criados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#1a9c6d]" /> Negócios ganhos
        </span>
      </div>
    </div>
  );
}

function originWinRate(o: ClintOriginRow): number | null {
  const decided = o.won + o.lost;
  return decided > 0 ? o.won / decided : null;
}

export default function InteligenciaComercialPage() {
  const { data, loading, error, fetchData } = useClintStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Carregando inteligência comercial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { overview, trends, funnel, origins, products, fontes, tags, originProductCross, insights } = data;

  const topOrigins = [...origins].sort((a, b) => b.total - a.total).slice(0, 10);
  const maxOriginTotal = Math.max(1, ...topOrigins.map((o) => o.total));
  const maxProductRevenue = Math.max(1, ...products.map((p) => p.revenue));
  const maxTagCount = Math.max(1, ...tags.map((t) => t.count));
  const maxFunnelCount = Math.max(1, ...funnel.map((f) => f.count));

  const totalContactsClassified = overview.contactsWithDeal + overview.contactsWithoutDeal;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-heading">
          <Sparkles className="h-5 w-5 text-primary" />
          Inteligência Comercial
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Contatos e negócios sincronizados da Clint — cruzamentos de origem, produto e tempo para
          decisões mais assertivas.
        </p>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="origem-produto">Origem &amp; Produto</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<Users2 className="h-4 w-4" />}
              label="Contatos"
              value={overview.totalContacts.toLocaleString("pt-BR")}
            />
            <StatCard
              icon={<Handshake className="h-4 w-4" />}
              label="Negócios"
              value={overview.totalDeals.toLocaleString("pt-BR")}
              subtitle={`${overview.openDeals} em aberto`}
            />
            <StatCard
              icon={<Target className="h-4 w-4" />}
              label="Taxa de conversão"
              value={overview.winRate !== null ? `${Math.round(overview.winRate * 100)}%` : "—"}
              subtitle={`${overview.wonDeals} ganhos · ${overview.lostDeals} perdidos`}
            />
            <StatCard
              icon={<Wallet className="h-4 w-4" />}
              label="Receita fechada"
              value={formatBRL(overview.totalRevenue)}
              subtitle={`Ticket médio: ${formatBRL(overview.avgTicket)}`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={<Timer className="h-4 w-4" />}
              label="Ciclo médio de fechamento"
              value={overview.avgDaysToWin !== null ? `${Math.round(overview.avgDaysToWin)} dias` : "—"}
              subtitle="Da criação do negócio até o ganho"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Contatos com negócio ativo"
              value={
                totalContactsClassified > 0
                  ? `${Math.round((overview.contactsWithDeal / totalContactsClassified) * 100)}%`
                  : "—"
              }
              subtitle={`${overview.contactsWithDeal.toLocaleString("pt-BR")} de ${totalContactsClassified.toLocaleString("pt-BR")} contatos`}
            />
          </div>

          <InsightsPanel insights={insights} />

          <WeeklyTrendChart
            contacts={trends.contactsWeekly}
            dealsCreated={trends.dealsCreatedWeekly}
            dealsWon={trends.dealsWonWeekly}
          />

          {funnel.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Funil (negócios em aberto por etapa)
              </p>
              <div className="space-y-3">
                {funnel.map((stage) => (
                  <RankBar
                    key={stage.stageId ?? stage.stage}
                    label={stage.stage}
                    value={stage.count}
                    maxValue={maxFunnelCount}
                    detail={`${stage.count} · ${formatBRL(stage.value)}`}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="origem-produto" className="space-y-6 mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Origens (por volume de negócios)
              </p>
              <div className="space-y-3">
                {topOrigins.map((origin) => {
                  const rate = originWinRate(origin);
                  return (
                    <RankBar
                      key={origin.originId ?? origin.originName}
                      label={origin.originName}
                      value={origin.total}
                      maxValue={maxOriginTotal}
                      detail={
                        rate !== null
                          ? `${origin.total} · ${Math.round(rate * 100)}% conversão`
                          : `${origin.total}`
                      }
                    />
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Produtos (por receita)
              </p>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">Nenhum negócio ganho com produto identificado ainda.</p>
              ) : (
                <div className="space-y-3">
                  {products.slice(0, 10).map((product: ClintProductRow) => (
                    <RankBar
                      key={product.product}
                      label={product.product}
                      value={product.revenue}
                      maxValue={maxProductRevenue}
                      detail={`${formatBRL(product.revenue)} · ${product.total} venda(s)`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {originProductCross.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Cruzamento origem × produto (negócios ganhos, por receita)
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {originProductCross.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.originName}</TableCell>
                      <TableCell className="text-muted-foreground">{row.product}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right font-medium">{formatBRL(row.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {fontes.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
              <div className="px-4 pt-4 pb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fonte do lead (canal de captação, mais granular que origem)
                </p>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ganhos</TableHead>
                    <TableHead className="text-right">Perdidos</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fontes.map((f) => {
                    const decided = f.won + f.lost;
                    const rate = decided > 0 ? Math.round((f.won / decided) * 100) : null;
                    return (
                      <TableRow key={f.fonte}>
                        <TableCell className="font-medium">{f.fonte}</TableCell>
                        <TableCell className="text-right">{f.total}</TableCell>
                        <TableCell className="text-right">{f.won}</TableCell>
                        <TableCell className="text-right">{f.lost}</TableCell>
                        <TableCell className="text-right">
                          {rate !== null ? <Badge variant="outline">{rate}%</Badge> : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="contatos" className="space-y-6 mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={<Users2 className="h-4 w-4" />}
              label="Com negócio associado"
              value={overview.contactsWithDeal.toLocaleString("pt-BR")}
            />
            <StatCard
              icon={<Users2 className="h-4 w-4" />}
              label="Sem negócio associado"
              value={overview.contactsWithoutDeal.toLocaleString("pt-BR")}
              subtitle="Base sem oportunidade comercial criada"
            />
          </div>

          {tags.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Tags mais usadas nos contatos
              </p>
              <div className="space-y-3">
                {tags.map((tag) => (
                  <RankBar key={tag.name} label={tag.name} value={tag.count} maxValue={maxTagCount} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
