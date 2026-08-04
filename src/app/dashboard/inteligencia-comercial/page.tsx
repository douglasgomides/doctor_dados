"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  useClintStore,
  ClintOriginRow,
  ClintProductRow,
  ClintWeeklyPoint,
  ClintInsightSection,
  ClintAction,
  ClintFilters,
} from "@/store/clint-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Clock,
  AlertTriangle,
  ListChecks,
  Filter,
  X,
  Flame,
  Info,
  Bot,
  ShieldAlert,
  MessagesSquare,
} from "lucide-react";
import "./theme.css";

/** Intervalo de atualização automática dos dados (resumo, negócios, atendimento). */
const AUTO_REFRESH_MS = 30_000;
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";

/**
 * Serifa de exibição própria desta página — a referência visual do usuário
 * pedia Cormorant Garamond para títulos e números-heróis. O resto do app usa
 * Lora (font-heading) e Sora (font-sans), já carregadas em layout.tsx; aqui
 * adicionamos só essa, escopada a esta página via a variável CSS abaixo.
 */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)} h`;
  return `${(minutes / 1440).toFixed(1)} dias`;
}

function timeSince(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = diffMs / (1000 * 60 * 60);
  if (hours < 1) return "há menos de 1h";
  if (hours < 24) return `há ${Math.round(hours)}h`;
  return `há ${Math.round(hours / 24)} dia(s)`;
}

/**
 * Pequeno rótulo maiúsculo com letter-spacing — "eyebrow" editorial usado
 * acima de títulos de seção grandes (masthead do topo, cabeçalhos de tab).
 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-primary">
      {children}
    </div>
  );
}

/**
 * Cabeçalho pequeno e consistente pra seções dentro de um card (rankings,
 * tabelas) — centraliza o estilo que antes se repetia como <p> solto em
 * cada seção, com ícone e badge de contagem opcionais. `tone="alert"` é
 * usado só onde o dado por trás é de fato um problema (ex.: atendimento
 * humano com leads sem resposta) — nunca em métricas de automação/engajamento.
 */
function SectionHeader({
  icon,
  title,
  badge,
  tone = "default",
}: {
  icon?: React.ReactNode;
  title: string;
  badge?: string | number;
  tone?: "default" | "alert";
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <span className={"shrink-0 " + (tone === "alert" ? "text-destructive" : "text-primary")}>{icon}</span>
      )}
      <p
        className={
          "text-[11px] font-semibold uppercase tracking-[0.1em] " +
          (tone === "alert" ? "text-destructive" : "text-muted-foreground")
        }
      >
        {title}
      </p>
      {badge !== undefined && (
        <Badge variant="outline" className="text-[10px] font-normal border-border text-muted-foreground">
          {badge}
        </Badge>
      )}
    </div>
  );
}

function DeltaBadge({ pct, invert = false }: { pct: number; invert?: boolean }) {
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 text-[11px] font-medium " +
        (good ? "text-[var(--ic-sage)]" : "text-destructive")
      }
    >
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  tone = "default",
  size = "default",
  deltaPct,
  invertDelta = false,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: "default" | "warning";
  size?: "default" | "compact";
  deltaPct?: number | null;
  invertDelta?: boolean;
  /** Destaca o valor em dourado — reservado pro número que mais importa de um grupo (ex.: receita). */
  highlight?: boolean;
}) {
  const compact = size === "compact";
  return (
    <div
      className={
        "rounded-[var(--radius)] border space-y-2.5 transition-colors " +
        (compact ? "p-3.5" : "p-5") +
        " " +
        (tone === "warning"
          ? "border-destructive/35 bg-destructive/[0.06]"
          : "border-border bg-card")
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className={
            "flex items-center justify-center rounded-md shrink-0 " +
            (compact ? "h-6 w-6" : "h-7 w-7") +
            " " +
            (tone === "warning" ? "bg-destructive/12 text-destructive" : "bg-primary/12 text-primary")
          }
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <div
          className={
            "ic-font-display font-semibold leading-none " +
            (compact ? "text-xl" : "text-[2.1rem]") +
            " " +
            (tone === "warning" ? "text-destructive" : highlight ? "text-primary" : "text-foreground")
          }
        >
          {value}
        </div>
        {deltaPct !== undefined && deltaPct !== null && <DeltaBadge pct={deltaPct} invert={invertDelta} />}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>}
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm gap-2">
        <span className="font-medium truncate text-foreground">{label}</span>
        <span className="text-muted-foreground text-xs shrink-0">{detail ?? value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--ic-border-soft)] overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Barra de duas partes pra mostrar uma proporção (ex.: contatos com/sem negócio) sem precisar de um donut. */
function SplitBar({
  a,
  b,
  aLabel,
  bLabel,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
}) {
  const total = a + b;
  const aPct = total > 0 ? Math.round((a / total) * 100) : 0;
  return (
    <div className="space-y-2.5">
      <div className="h-2.5 rounded-full overflow-hidden flex bg-[var(--ic-border-soft)]">
        <div className="h-full bg-primary" style={{ width: `${aPct}%` }} />
        <div className="h-full bg-muted-foreground/25" style={{ width: `${Math.max(0, 100 - aPct)}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          {aLabel}: <span className="font-medium text-foreground">{a.toLocaleString("pt-BR")}</span> ({aPct}%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
          {bLabel}: <span className="font-medium text-foreground">{b.toLocaleString("pt-BR")}</span> ({100 - aPct}%)
        </span>
      </div>
    </div>
  );
}

/**
 * Barra de proporção com N segmentos — usada pra mostrar de uma vez só como
 * os contatos que escreveram se dividem entre atendimento humano, resposta
 * automática (infoproduto) e nenhuma resposta, em vez de espalhar isso em
 * três cartões de número solto. `colorVar` é o nome de uma custom property
 * CSS já definida no escopo (ex.: "--primary", "--destructive").
 */
function ProportionBar({
  segments,
}: {
  segments: { label: string; value: number; colorVar: string; description: string }[];
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div className="space-y-4">
      <div className="h-3 rounded-full overflow-hidden flex bg-[var(--ic-border-soft)]">
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={i}
              className="h-full"
              style={{ width: `${pct}%`, backgroundColor: `var(${seg.colorVar})` }}
              title={`${seg.label}: ${seg.value.toLocaleString("pt-BR")}`}
            />
          );
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {segments.map((seg, i) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: `var(${seg.colorVar})` }}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                  {seg.label}
                </p>
                <p
                  className="ic-font-display text-2xl font-semibold leading-tight mt-0.5"
                  style={{ color: `var(${seg.colorVar})` }}
                >
                  {seg.value.toLocaleString("pt-BR")}
                  <span className="text-sm font-medium text-muted-foreground ml-1.5">{pct}%</span>
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{seg.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Painel de leitura narrativa ("briefing do analista") a partir das seções
 * de insight geradas no backend — visual mais editorial que uma lista crua:
 * cartão com leve destaque de marca por fora, subcartões por tema por
 * dentro, com marcadores discretos em vez de bullets padrão.
 */
function InsightSectionsPanel({ sections }: { sections: ClintInsightSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="rounded-[var(--radius)] border border-primary/25 bg-gradient-to-br from-primary/[0.06] to-transparent p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/12 text-primary shrink-0">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="ic-font-display text-lg font-semibold leading-tight text-foreground">Leitura do período</p>
          <p className="text-xs text-muted-foreground">O que os números mostram, direto ao ponto</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-[var(--radius)] border border-border bg-card/70 p-4 space-y-2.5 border-l-2 border-l-primary/50"
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" />
              {section.title}
            </div>
            <ul className="space-y-1.5">
              {section.items.map((item, i) => (
                <li
                  key={i}
                  className="text-sm text-muted-foreground leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:h-1 before:w-1 before:rounded-full before:bg-primary/60"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const IMPACT_CONFIG: Record<
  ClintAction["impacto"],
  { order: number; border: string; badgeVariant: "destructive" | "outline"; icon: React.ReactNode }
> = {
  Alto: { order: 0, border: "border-l-destructive", badgeVariant: "destructive", icon: <Flame className="h-3 w-3" /> },
  Médio: { order: 1, border: "border-l-[var(--chart-4)]", badgeVariant: "outline", icon: <Clock className="h-3 w-3" /> },
  Baixo: {
    order: 2,
    border: "border-l-muted-foreground/40",
    badgeVariant: "outline",
    icon: <Info className="h-3 w-3" />,
  },
};

function ActionCard({ action, index }: { action: ClintAction; index: number }) {
  const cfg = IMPACT_CONFIG[action.impacto];
  return (
    <div
      className={`rounded-[var(--radius)] border border-border bg-card p-5 space-y-3 border-l-[3px] ${cfg.border} hover:border-primary/40 transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[11px] font-semibold text-muted-foreground shrink-0 mt-0.5">
            {index + 1}
          </span>
          <span className="ic-font-display font-semibold text-lg leading-snug text-foreground">{action.titulo}</span>
        </div>
        <Badge variant={cfg.badgeVariant} className="shrink-0 text-[10px] gap-1">
          {cfg.icon}
          {action.impacto}
        </Badge>
      </div>
      <div className="pl-8 space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Por quê: </span>
          {action.porque}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">O que fazer: </span>
          {action.oque}
        </p>
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground/80 border-border">
          Prazo: {action.prazo}
        </Badge>
      </div>
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
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <SectionHeader title="Tendência semanal" />
      <div className="h-56 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={merged} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="clint-contatos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clint-negocios" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="clint-ganhos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                color: "var(--foreground)",
              }}
              labelStyle={{ color: "var(--primary)" }}
            />
            <Area
              type="monotone"
              dataKey="contatos"
              name="Contatos novos"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#clint-contatos)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="negocios"
              name="Negócios criados"
              stroke="var(--chart-4)"
              strokeWidth={2}
              fill="url(#clint-negocios)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="ganhos"
              name="Negócios ganhos"
              stroke="var(--chart-2)"
              strokeWidth={2}
              fill="url(#clint-ganhos)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} /> Contatos novos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-4)" }} /> Negócios criados
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-2)" }} /> Negócios ganhos
        </span>
      </div>
    </div>
  );
}

function originWinRate(o: ClintOriginRow): number | null {
  const decided = o.won + o.lost;
  return decided > 0 ? o.won / decided : null;
}

const STATUS_LABEL: Record<string, string> = { OPEN: "Em aberto", WON: "Ganho", LOST: "Perdido" };
const STATUS_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  OPEN: "outline",
  WON: "default",
  LOST: "destructive",
};

/**
 * Filtro global de data e produto — afeta resumo, negócios e atendimento ao
 * mesmo tempo. Os dados em si se atualizam sozinhos (ver AUTO_REFRESH_MS em
 * cada aba), sem precisar de botão de atualizar manual.
 */
function FilterBar({
  filters,
  onApply,
  productOptions,
  funilOptions,
  loading,
}: {
  filters: ClintFilters;
  onApply: (filters: ClintFilters) => void;
  productOptions: string[];
  funilOptions: string[];
  loading: boolean;
}) {
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [product, setProduct] = useState(filters.product ?? "todos");
  const [origin, setOrigin] = useState(filters.origin ?? "todos");

  const activeCount = [filters.from, filters.to, filters.product, filters.origin].filter(Boolean).length;
  const hasActiveFilters = activeCount > 0;

  function apply() {
    onApply({
      from: from || undefined,
      to: to || undefined,
      product: product !== "todos" ? product : undefined,
      origin: origin !== "todos" ? origin : undefined,
    });
  }

  function clear() {
    setFrom("");
    setTo("");
    setProduct("todos");
    setOrigin("todos");
    onApply({});
  }

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-3.5 flex flex-wrap items-end gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground pb-2 pr-1 uppercase tracking-wide">
        <Filter className="h-3.5 w-3.5 text-primary" />
        Filtros
        {hasActiveFilters && (
          <Badge variant="outline" className="text-[10px] font-normal normal-case border-border">
            {activeCount} ativo{activeCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground uppercase tracking-wide">De</label>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-[150px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Até</label>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Produto</label>
        <Select value={product} onValueChange={setProduct}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os produtos</SelectItem>
            {productOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Funil</label>
        <Select value={origin} onValueChange={setOrigin}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os funis</SelectItem>
            {funilOptions.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={apply} disabled={loading}>
        Aplicar filtros
      </Button>
      {hasActiveFilters && (
        <Button size="sm" variant="outline" onClick={clear} disabled={loading}>
          <X className="h-3.5 w-3.5" />
          Limpar
        </Button>
      )}
    </div>
  );
}

function NegociosTab({ filters }: { filters: ClintFilters }) {
  const { deals, dealsLoading, dealsError, fetchDeals } = useClintStore();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const searchRef = useRef(search);
  const statusRef = useRef(status);
  searchRef.current = search;
  statusRef.current = status;

  function currentParams() {
    return {
      search: searchRef.current || undefined,
      status: statusRef.current !== "todos" ? statusRef.current : undefined,
      offset: 0,
      ...filters,
    };
  }

  useEffect(() => {
    fetchDeals(currentParams());
    const id = setInterval(() => fetchDeals(currentParams()), AUTO_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDeals, filters]);

  function applyFilters() {
    fetchDeals(currentParams());
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nome do contato ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="max-w-xs"
          />
          <Select value={status} onValueChange={(v) => { setStatus(v); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="OPEN">Em aberto</SelectItem>
              <SelectItem value="WON">Ganhos</SelectItem>
              <SelectItem value="LOST">Perdidos</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyFilters} disabled={dealsLoading}>
            {dealsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
          {deals && (
            <span className="text-xs text-muted-foreground ml-auto">
              mostrando <span className="font-medium text-foreground">{deals.deals.length}</span> de{" "}
              {deals.total.toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {dealsError && <p className="text-sm text-destructive">{dealsError}</p>}

        <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-border">
                <TableHead className="text-muted-foreground">Data</TableHead>
                <TableHead className="text-muted-foreground">Contato</TableHead>
                <TableHead className="text-muted-foreground">Produto</TableHead>
                <TableHead className="text-muted-foreground">Origem</TableHead>
                <TableHead className="text-muted-foreground">Etapa</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-right text-muted-foreground">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals?.deals.map((d) => (
                <TableRow key={d.id} className="border-[var(--ic-border-soft)] hover:bg-primary/[0.04]">
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDateTime(d.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate text-foreground">{d.contactName}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {d.product || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{d.originName}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{d.stage || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[d.status] ?? "outline"}>
                      {STATUS_LABEL[d.status] ?? d.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap ic-font-display text-base text-primary">
                    {formatBRL(d.value)}
                  </TableCell>
                </TableRow>
              ))}
              {deals && deals.deals.length === 0 && (
                <TableRow className="border-[var(--ic-border-soft)]">
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum negócio encontrado com esses filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function AtendimentoTab({ filters }: { filters: ClintFilters }) {
  const { atendimento, atendimentoLoading, atendimentoError, fetchAtendimento } = useClintStore();

  useEffect(() => {
    fetchAtendimento(filters);
    const id = setInterval(() => fetchAtendimento(filters), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAtendimento, filters]);

  if (atendimentoLoading && !atendimento) {
    return (
      <div className="flex items-center justify-center h-48 mt-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (atendimentoError) {
    return <p className="text-destructive mt-4">{atendimentoError}</p>;
  }

  if (!atendimento) return null;

  const { overview, byOrigin, byChannel, channels, unanswered, multiChannelContacts, comments } = atendimento;
  const disconnectedChannels = channels.filter((c) => c.status !== "CONNECTED");
  const hasAttentionIssue = overview.nuncaRespondido > 0;

  if (overview.totalChats === 0 && channels.length === 0) {
    return (
      <div className="rounded-[var(--radius)] border border-border bg-card p-6 mt-4 text-sm text-muted-foreground">
        Nenhum chat sincronizado ainda. Rode a sincronização com{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">resource=messages</code> (e{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">resource=channels</code>) pra ver dados de
        atendimento aqui (cobre os contatos com negócio associado, priorizando os mais recentes).
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-4">
      {disconnectedChannels.length > 0 && (
        <div className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/[0.08] p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {disconnectedChannels.length === 1 ? "Canal desconectado" : "Canais desconectados"} na Clint
          </div>
          <p className="text-sm text-muted-foreground">
            {disconnectedChannels.map((c) => `"${c.name}" (${c.type === "INSTAGRAM" ? "@" + c.identifier : c.identifier})`).join(", ")}
            {" — "}
            mensagens novas desses canais provavelmente não estão sendo capturadas pela Clint agora.
            Reconecte no painel da Clint (Configurações → Canais) o quanto antes.
          </p>
        </div>
      )}

      {/* ============ ZONA QUENTE: atendimento humano de verdade ============
          Só conta como "respondido" quando uma PESSOA do time respondiu
          (user_id preenchido) — uma resposta automática do bot não conta,
          senão o time parece mais rápido/presente do que realmente está.
          É a única seção desta aba com tratamento de cor de alarme, porque é
          a única que mede desempenho real do time. */}
      <div className="space-y-4">
        <SectionHeader
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Atendimento humano — o que mede o time de verdade"
          tone={hasAttentionIssue ? "alert" : "default"}
        />

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-4">
            <SectionHeader title="Como os contatos foram atendidos" badge={overview.totalComContato.toLocaleString("pt-BR")} />
            <ProportionBar
              segments={[
                {
                  label: "Atendimento humano",
                  value: overview.totalAtendimentoHumano,
                  colorVar: "--primary",
                  description: "Uma pessoa do time respondeu",
                },
                {
                  label: "Infoproduto (automação)",
                  value: overview.totalInfoproduto,
                  colorVar: "--ic-sage",
                  description: "Só bot/ManyChat respondeu — funil automático funcionando, não é falha",
                },
                {
                  label: "Sem nenhuma resposta",
                  value: overview.nuncaRespondido,
                  colorVar: "--destructive",
                  description: "Nem bot, nem humano respondeu",
                },
              ]}
            />
          </div>

          <div className="grid gap-4 grid-cols-2 lg:grid-cols-1">
            <StatCard
              icon={<Clock className="h-4 w-4" />}
              label="Tempo médio de resposta humana"
              value={formatMinutes(overview.avgResponseMinutes)}
              subtitle="Só conta quando uma pessoa do time respondeu"
            />
            <StatCard
              icon={<MessagesSquare className="h-4 w-4" />}
              label="Mensagens diretas"
              value={overview.totalDirectMessages.toLocaleString("pt-BR")}
              subtitle="Trocadas no período, todos os canais"
              size="compact"
            />
          </div>
        </div>

        {unanswered.length > 0 && (
          <div className="rounded-[var(--radius)] border border-destructive/35 bg-destructive/[0.05] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Leads que mandaram mensagem e não receberam nenhuma resposta (nem bot, nem humano)
              <Badge variant="destructive" className="text-[10px]">
                {unanswered.length}
              </Badge>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {unanswered.map((u) => (
                <div key={u.chatId} className="rounded-[var(--radius)] border border-border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{u.contactName}</span>
                    <span className="text-xs text-muted-foreground">
                      mensagem {timeSince(u.firstCustomerMessageAt)}
                      {u.channelName ? ` · ${u.channelName}` : ""} · {u.originName || "sem origem"}
                    </span>
                  </div>
                  {u.lastMessageContent && (
                    <p className="text-sm text-muted-foreground italic truncate">&quot;{u.lastMessageContent}&quot;</p>
                  )}
                  {u.stage && (
                    <p className="text-xs text-muted-foreground">
                      Etapa: {u.stage}
                      {u.value ? ` · ${formatBRL(u.value)}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {byChannel.length > 0 && (
          <div className="rounded-[var(--radius)] border border-border overflow-hidden overflow-x-auto">
            <div className="px-5 pt-4 pb-2">
              <SectionHeader title="Atendimento por canal (WhatsApp × Instagram)" />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Canal</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-muted-foreground">Chats</TableHead>
                  <TableHead className="text-right text-muted-foreground">Infoproduto</TableHead>
                  <TableHead className="text-right text-muted-foreground">Comentários</TableHead>
                  <TableHead className="text-right text-muted-foreground">Sem resposta</TableHead>
                  <TableHead className="text-right text-muted-foreground">Tempo médio (humano)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byChannel.map((c) => (
                  <TableRow key={c.channelName} className="border-[var(--ic-border-soft)] hover:bg-primary/[0.04]">
                    <TableCell className="font-medium text-foreground">
                      {c.channelName}
                      <span className="text-muted-foreground font-normal"> · {c.channelType}</span>
                    </TableCell>
                    <TableCell>
                      {c.channelStatus === "CONNECTED" ? (
                        <Badge variant="outline" className="text-[var(--ic-sage)] border-[var(--ic-sage-border)]">
                          Conectado
                        </Badge>
                      ) : c.channelStatus ? (
                        <Badge variant="destructive">Desconectado</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{c.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.totalInfoproduto}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.totalComments}</TableCell>
                    <TableCell className="text-right">
                      {c.nuncaRespondido > 0 ? <Badge variant="destructive">{c.nuncaRespondido}</Badge> : "0"}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{formatMinutes(c.avgResponseMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {byOrigin.length > 0 && (
          <div className="rounded-[var(--radius)] border border-border overflow-hidden overflow-x-auto">
            <div className="px-5 pt-4 pb-2">
              <SectionHeader title="Atendimento por origem" />
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Origem</TableHead>
                  <TableHead className="text-right text-muted-foreground">Chats</TableHead>
                  <TableHead className="text-right text-muted-foreground">Infoproduto</TableHead>
                  <TableHead className="text-right text-muted-foreground">Sem resposta</TableHead>
                  <TableHead className="text-right text-muted-foreground">Tempo médio (humano)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byOrigin.map((o) => (
                  <TableRow key={o.originName} className="border-[var(--ic-border-soft)] hover:bg-primary/[0.04]">
                    <TableCell className="font-medium text-foreground">{o.originName}</TableCell>
                    <TableCell className="text-right text-foreground">{o.total}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{o.totalInfoproduto}</TableCell>
                    <TableCell className="text-right">
                      {o.nuncaRespondido > 0 ? (
                        <Badge variant="destructive">{o.nuncaRespondido}</Badge>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-foreground">{formatMinutes(o.avgResponseMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ============ ZONA CALMA: automação e engajamento ============
          Infoproduto, comentários e contatos multi-canal não são falha de
          atendimento — são informativos. Paleta neutra/sage deliberada, sem
          nenhum tom de alarme, pra não competir visualmente com a zona
          quente acima. */}
      <div className="space-y-4">
        <SectionHeader icon={<Bot className="h-4 w-4" />} title="Automação & engajamento — informativo" />
        <p className="text-xs text-muted-foreground -mt-2 max-w-2xl">
          Volume de conversas resolvidas por automação e engajamento em posts — não entra no cálculo de tempo de
          resposta nem de leads sem atendimento, porque não é atendimento humano.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          {comments.recent.length > 0 && (
            <div className="rounded-[var(--radius)] border border-[var(--ic-sage-border)] bg-[var(--ic-sage-bg)] p-4 space-y-3">
              <SectionHeader
                icon={<Bot className="h-3.5 w-3.5" />}
                title="Comentários no Instagram"
                badge={comments.total.toLocaleString("pt-BR")}
              />
              <p className="text-xs text-muted-foreground -mt-1.5">
                Comentário em post, respondido automaticamente pelo ManyChat — engajamento, não conversa.
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {comments.recent.map((cm) => (
                  <div key={cm.id} className="rounded-[var(--radius)] border border-border bg-card p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{cm.contactName}</span>
                      <span className="text-xs text-muted-foreground">
                        {timeSince(cm.createdAt)}
                        {cm.channelName ? ` · ${cm.channelName}` : ""}
                      </span>
                    </div>
                    {cm.content && (
                      <p className="text-sm text-muted-foreground italic truncate">&quot;{cm.content}&quot;</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {multiChannelContacts.length > 0 && (
            <div className="rounded-[var(--radius)] border border-border bg-card p-4 space-y-3">
              <SectionHeader
                icon={<Users2 className="h-3.5 w-3.5" />}
                title="Contatos conversando em mais de um canal"
                badge={multiChannelContacts.length}
              />
              <p className="text-xs text-muted-foreground -mt-1.5">
                Podem estar mandando mensagem simultaneamente pelo WhatsApp e pelo Instagram — vale unificar o
                atendimento pra não responder duplicado (ou pior, deixar um dos dois sem resposta).
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {multiChannelContacts.map((m) => (
                  <div
                    key={m.contactId}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-background/60 p-2.5 text-sm"
                  >
                    <span className="font-medium truncate text-foreground">{m.contactName}</span>
                    <span className="text-xs text-muted-foreground text-right shrink-0">
                      {m.channelNames.join(" + ")} · {timeSince(m.lastActivityAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InteligenciaComercialPage() {
  const { data, loading, error, fetchData } = useClintStore();
  const [filters, setFilters] = useState<ClintFilters>({});

  useEffect(() => {
    fetchData(filters);
    const id = setInterval(() => fetchData(filters), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData, filters]);

  if (loading && !data) {
    return (
      <div className={`${cormorant.variable} ic-theme -m-6 min-h-[calc(100vh-4rem)] flex items-center justify-center`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Carregando inteligência comercial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cormorant.variable} ic-theme -m-6 min-h-[calc(100vh-4rem)] flex items-center justify-center`}>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const {
    overview,
    previousPeriod,
    trends,
    funnel,
    lossByStage,
    lossReasons,
    bySeller,
    cycleTimeTrend,
    origins,
    products,
    fontes,
    tags,
    originProductCross,
    insightSections,
    actions,
  } = data;

  const topOrigins = [...origins].sort((a, b) => b.total - a.total).slice(0, 10);
  const maxOriginTotal = Math.max(1, ...topOrigins.map((o) => o.total));
  const maxProductRevenue = Math.max(1, ...products.map((p) => p.revenue));
  const maxTagCount = Math.max(1, ...tags.map((t) => t.count));
  const maxFunnelCount = Math.max(1, ...funnel.map((f) => f.count));
  const maxLossStageCount = Math.max(1, ...lossByStage.map((s) => s.count));
  const maxLossReasonTotal = Math.max(1, ...lossReasons.map((r) => r.total));
  const looksLikeRawId = (s: string) => /^[0-9a-f-]{20,}$/i.test(s);

  const totalContactsClassified = overview.contactsWithDeal + overview.contactsWithoutDeal;

  const cycleTimeDeltaPct =
    cycleTimeTrend.length >= 2
      ? pctDelta(
          cycleTimeTrend[cycleTimeTrend.length - 1].avgDays,
          cycleTimeTrend[cycleTimeTrend.length - 2].avgDays
        )
      : null;

  const sortedActions = [...actions].sort(
    (a, b) => IMPACT_CONFIG[a.impacto].order - IMPACT_CONFIG[b.impacto].order
  );
  const impactCounts = actions.reduce<Record<string, number>>((acc, a) => {
    acc[a.impacto] = (acc[a.impacto] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={`${cormorant.variable} ic-theme -m-6 min-h-[calc(100vh-4rem)] px-6 py-8 sm:px-8 lg:px-10`}>
      <div className="max-w-6xl mx-auto space-y-7">
        <div>
          <Eyebrow>Doctor Creator · Painel Comercial</Eyebrow>
          <h1 className="ic-font-display text-4xl font-semibold tracking-tight text-foreground flex items-center gap-2.5 mt-1">
            <Sparkles className="h-6 w-6 text-primary" />
            Inteligência Comercial
          </h1>
          <p className="font-heading italic text-sm text-muted-foreground mt-1.5 max-w-2xl">
            Contatos, negócios e atendimento sincronizados da Clint — cruzamentos de origem, produto e tempo
            de resposta para decisões mais assertivas. Atualiza sozinho a cada 30 segundos.
          </p>
        </div>

        <FilterBar
          filters={filters}
          onApply={setFilters}
          productOptions={data.productOptions}
          funilOptions={data.originOptions}
          loading={loading}
        />

        <Tabs defaultValue="resumo">
          <div className="overflow-x-auto">
            <TabsList
              variant="line"
              className="w-full justify-start border-b border-border h-auto p-0 gap-1 bg-transparent"
            >
              {[
                { value: "resumo", label: "Resumo" },
                { value: "negocios", label: "Negócios" },
                { value: "atendimento", label: "Atendimento" },
                { value: "origem-produto", label: "Origem & Produto" },
                { value: "contatos", label: "Contatos" },
                { value: "acoes", label: "Ações a Tomar" },
              ].map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="uppercase tracking-[0.06em] text-[11.5px] font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:after:bg-primary px-3.5 py-2.5 whitespace-nowrap"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="resumo" className="space-y-7 mt-5">
            {previousPeriod && (
              <p className="text-xs text-muted-foreground -mb-2">
                Comparando com o período anterior de mesmo tamanho (variação ao lado de cada número).
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Users2 className="h-4 w-4" />}
                label="Contatos"
                value={overview.totalContacts.toLocaleString("pt-BR")}
                deltaPct={previousPeriod ? pctDelta(overview.totalContacts, previousPeriod.totalContacts) : undefined}
              />
              <StatCard
                icon={<Handshake className="h-4 w-4" />}
                label="Negócios"
                value={overview.totalDeals.toLocaleString("pt-BR")}
                subtitle={`${overview.openDeals} em aberto`}
                deltaPct={previousPeriod ? pctDelta(overview.totalDeals, previousPeriod.totalDeals) : undefined}
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
                deltaPct={previousPeriod ? pctDelta(overview.totalRevenue, previousPeriod.totalRevenue) : undefined}
                highlight
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                size="compact"
                icon={<Timer className="h-4 w-4" />}
                label="Ciclo médio de fechamento"
                value={overview.avgDaysToWin !== null ? `${Math.round(overview.avgDaysToWin)} dias` : "—"}
                subtitle="Da criação do negócio até o ganho · variação vs. semana anterior"
                deltaPct={cycleTimeDeltaPct}
                invertDelta
              />
              <StatCard
                size="compact"
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

            <InsightSectionsPanel sections={insightSections} />

            <WeeklyTrendChart
              contacts={trends.contactsWeekly}
              dealsCreated={trends.dealsCreatedWeekly}
              dealsWon={trends.dealsWonWeekly}
            />

            {funnel.length > 0 && (
              <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
                <SectionHeader title="Funil (negócios em aberto por etapa)" />
                <div className="space-y-3.5 mt-1">
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

          <TabsContent value="negocios">
            <NegociosTab filters={filters} />
          </TabsContent>

          <TabsContent value="atendimento">
            <AtendimentoTab filters={filters} />
          </TabsContent>

          <TabsContent value="origem-produto" className="space-y-7 mt-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
                <SectionHeader title="Origens (por volume de negócios)" />
                <div className="space-y-3.5 mt-1">
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

              <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
                <SectionHeader title="Produtos (por receita)" />
                {products.length === 0 ? (
                  <p className="text-sm text-muted-foreground/60">Nenhum negócio ganho com produto identificado ainda.</p>
                ) : (
                  <div className="space-y-3.5 mt-1">
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
              <div className="rounded-[var(--radius)] border border-border overflow-hidden overflow-x-auto">
                <div className="px-5 pt-4 pb-2">
                  <SectionHeader title="Cruzamento origem × produto (negócios ganhos, por receita)" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Origem</TableHead>
                      <TableHead className="text-muted-foreground">Produto</TableHead>
                      <TableHead className="text-right text-muted-foreground">Vendas</TableHead>
                      <TableHead className="text-right text-muted-foreground">Receita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {originProductCross.map((row, i) => (
                      <TableRow key={i} className="border-[var(--ic-border-soft)] hover:bg-primary/[0.04]">
                        <TableCell className="font-medium text-foreground">{row.originName}</TableCell>
                        <TableCell className="text-muted-foreground">{row.product}</TableCell>
                        <TableCell className="text-right text-foreground">{row.total}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{formatBRL(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {fontes.length > 0 && (
              <div className="rounded-[var(--radius)] border border-border overflow-hidden overflow-x-auto">
                <div className="px-5 pt-4 pb-2">
                  <SectionHeader title="Fonte do lead (canal de captação, mais granular que origem)" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-muted-foreground">Fonte</TableHead>
                      <TableHead className="text-right text-muted-foreground">Total</TableHead>
                      <TableHead className="text-right text-muted-foreground">Ganhos</TableHead>
                      <TableHead className="text-right text-muted-foreground">Perdidos</TableHead>
                      <TableHead className="text-right text-muted-foreground">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fontes.map((f) => {
                      const decided = f.won + f.lost;
                      const rate = decided > 0 ? Math.round((f.won / decided) * 100) : null;
                      return (
                        <TableRow key={f.fonte} className="border-[var(--ic-border-soft)] hover:bg-primary/[0.04]">
                          <TableCell className="font-medium text-foreground">{f.fonte}</TableCell>
                          <TableCell className="text-right text-foreground">{f.total}</TableCell>
                          <TableCell className="text-right text-foreground">{f.won}</TableCell>
                          <TableCell className="text-right text-foreground">{f.lost}</TableCell>
                          <TableCell className="text-right">
                            {rate !== null ? <Badge variant="outline" className="border-border">{rate}%</Badge> : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {lossByStage.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
                  <SectionHeader
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    title="Perdas por etapa (gargalo do funil)"
                  />
                  <div className="space-y-3.5 mt-1">
                    {lossByStage.map((s) => (
                      <RankBar
                        key={s.stageId ?? s.stage}
                        label={s.stage}
                        value={s.count}
                        maxValue={maxLossStageCount}
                        detail={`${s.count} · ${formatBRL(s.value)}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
                  <SectionHeader title="Motivos de perda" />
                  {lossReasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60">Nenhum negócio perdido no período.</p>
                  ) : (
                    <>
                      {lossReasons.some((r) => looksLikeRawId(r.reason)) && (
                        <p className="text-[11px] text-muted-foreground/70 italic">
                          A Clint não expõe o nome legível do motivo pra alguns registros — aparecem como
                          código bruto abaixo.
                        </p>
                      )}
                      <div className="space-y-3.5 mt-1">
                        {lossReasons.slice(0, 10).map((r) => (
                          <RankBar
                            key={r.reason}
                            label={r.reason}
                            value={r.total}
                            maxValue={maxLossReasonTotal}
                            detail={`${r.total} · ${formatBRL(r.value)}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {bySeller.length > 0 && (
              <div className="rounded-[var(--radius)] border border-border overflow-hidden overflow-x-auto">
                <div className="px-5 pt-4 pb-2">
                  <SectionHeader title="Ticket médio e produção por vendedor (negócios ganhos)" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40 border-border">
                      <TableHead className="text-muted-foreground">Vendedor</TableHead>
                      <TableHead className="text-right text-muted-foreground">Vendas</TableHead>
                      <TableHead className="text-right text-muted-foreground">Receita</TableHead>
                      <TableHead className="text-right text-muted-foreground">Ticket médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bySeller.map((s) => (
                      <TableRow key={s.seller} className="border-[var(--ic-border-soft)] hover:bg-primary/[0.04]">
                        <TableCell className="font-medium text-foreground">{s.seller}</TableCell>
                        <TableCell className="text-right text-foreground">{s.total}</TableCell>
                        <TableCell className="text-right font-medium text-primary">{formatBRL(s.revenue)}</TableCell>
                        <TableCell className="text-right text-foreground">{formatBRL(s.avgTicket)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="contatos" className="space-y-7 mt-5">
            <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
              <SectionHeader icon={<Users2 className="h-3.5 w-3.5" />} title="Base de contatos" />
              <div className="flex items-baseline gap-2">
                <span className="ic-font-display text-3xl font-semibold text-foreground">
                  {totalContactsClassified.toLocaleString("pt-BR")}
                </span>
                <span className="text-xs text-muted-foreground">contatos no total</span>
              </div>
              <SplitBar
                a={overview.contactsWithDeal}
                b={overview.contactsWithoutDeal}
                aLabel="Com negócio"
                bLabel="Sem negócio"
              />
            </div>

            {tags.length > 0 && (
              <div className="rounded-[var(--radius)] border border-border bg-card p-5 space-y-3">
                <SectionHeader title="Tags mais usadas nos contatos" />
                <div className="space-y-3.5 mt-1">
                  {tags.map((tag) => (
                    <RankBar key={tag.name} label={tag.name} value={tag.count} maxValue={maxTagCount} />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="acoes" className="space-y-5 mt-5">
            {actions.length === 0 ? (
              <div className="rounded-[var(--radius)] border border-dashed border-border p-8 text-center space-y-2">
                <ListChecks className="h-6 w-6 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground">Nenhuma ação sugerida com os dados atuais.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5 shrink-0" />
                    Recomendações calculadas a partir dos dados sincronizados — revise antes de agir.
                  </span>
                  <span className="flex-1" />
                  {(["Alto", "Médio", "Baixo"] as const)
                    .filter((k) => impactCounts[k])
                    .map((k) => (
                      <Badge key={k} variant={IMPACT_CONFIG[k].badgeVariant} className="text-[11px] gap-1">
                        {IMPACT_CONFIG[k].icon}
                        {impactCounts[k]} de impacto {k.toLowerCase()}
                      </Badge>
                    ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sortedActions.map((action, i) => (
                    <ActionCard key={i} action={action} index={i} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
