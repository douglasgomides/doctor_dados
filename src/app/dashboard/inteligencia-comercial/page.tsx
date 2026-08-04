"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  MessageCircleWarning,
  Clock,
  AlertTriangle,
  ListChecks,
  Filter,
  X,
} from "lucide-react";

/** Intervalo de atualização automática dos dados (resumo, negócios, atendimento). */
const AUTO_REFRESH_MS = 30_000;
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";

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

function StatCard({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={
        "rounded-xl border p-4 space-y-2 " +
        (tone === "warning" ? "border-destructive/30 bg-destructive/[0.05]" : "border-border bg-card")
      }
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <span className={tone === "warning" ? "text-destructive" : "text-primary"}>{icon}</span>
        {label}
      </div>
      <div className={"text-2xl font-bold font-heading " + (tone === "warning" ? "text-destructive" : "")}>
        {value}
      </div>
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

function InsightSectionsPanel({ sections }: { sections: ClintInsightSection[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sections.map((section) => (
        <div
          key={section.title}
          className="rounded-xl border border-border bg-card p-4 space-y-2.5 border-l-2 border-l-primary"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-primary shrink-0" />
            {section.title}
          </div>
          <ul className="space-y-2">
            {section.items.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

const IMPACT_COLOR: Record<ClintAction["impacto"], string> = {
  Alto: "border-l-destructive",
  Médio: "border-l-amber-500",
  Baixo: "border-l-muted-foreground",
};

function ActionCard({ action }: { action: ClintAction }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 space-y-2.5 border-l-2 ${IMPACT_COLOR[action.impacto]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm">{action.titulo}</span>
        <Badge variant={action.impacto === "Alto" ? "destructive" : "outline"} className="shrink-0 text-[10px]">
          Impacto {action.impacto}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Por quê: </span>
        {action.porque}
      </p>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">O que fazer: </span>
        {action.oque}
      </p>
      <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wide">Prazo: {action.prazo}</p>
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
  loading,
}: {
  filters: ClintFilters;
  onApply: (filters: ClintFilters) => void;
  productOptions: string[];
  loading: boolean;
}) {
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [product, setProduct] = useState(filters.product ?? "todos");

  const hasActiveFilters = Boolean(filters.from || filters.to || filters.product);

  function apply() {
    onApply({
      from: from || undefined,
      to: to || undefined,
      product: product !== "todos" ? product : undefined,
    });
  }

  function clear() {
    setFrom("");
    setTo("");
    setProduct("todos");
    onApply({});
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-wrap items-end gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground pb-2 pr-1">
        <Filter className="h-3.5 w-3.5" />
        Filtros
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
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
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
              mostrando {deals.deals.length} de {deals.total.toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {dealsError && <p className="text-sm text-destructive">{dealsError}</p>}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals?.deals.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDateTime(d.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[180px] truncate">{d.contactName}</TableCell>
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
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {formatBRL(d.value)}
                  </TableCell>
                </TableRow>
              ))}
              {deals && deals.deals.length === 0 && (
                <TableRow>
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

  const { overview, byOrigin, byChannel, channels, unanswered, multiChannelContacts } = atendimento;
  const disconnectedChannels = channels.filter((c) => c.status !== "CONNECTED");

  if (overview.totalChats === 0 && channels.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 mt-4 text-sm text-muted-foreground">
        Nenhum chat sincronizado ainda. Rode a sincronização com{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">resource=messages</code> (e{" "}
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">resource=channels</code>) pra ver dados de
        atendimento aqui (cobre os contatos com negócio associado, priorizando os mais recentes).
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      {disconnectedChannels.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/[0.07] p-4 space-y-2">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<MessageCircleWarning className="h-4 w-4" />}
          label="Nunca respondidos"
          value={overview.nuncaRespondido.toLocaleString("pt-BR")}
          subtitle={
            overview.pctNuncaRespondido !== null
              ? `${Math.round(overview.pctNuncaRespondido * 100)}% dos chats com mensagem`
              : undefined
          }
          tone={overview.nuncaRespondido > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Tempo médio de 1ª resposta"
          value={formatMinutes(overview.avgResponseMinutes)}
        />
        <StatCard
          icon={<Users2 className="h-4 w-4" />}
          label="Chats sincronizados"
          value={overview.totalChats.toLocaleString("pt-BR")}
        />
        <StatCard
          icon={<Users2 className="h-4 w-4" />}
          label="Mensagens sincronizadas"
          value={overview.totalMessages.toLocaleString("pt-BR")}
        />
      </div>

      {unanswered.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Leads que mandaram mensagem e nunca foram respondidos ({unanswered.length})
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {unanswered.map((u) => (
              <div key={u.chatId} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-sm">{u.contactName}</span>
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
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Atendimento por canal (WhatsApp × Instagram)
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Chats</TableHead>
                <TableHead className="text-right">Nunca respondidos</TableHead>
                <TableHead className="text-right">Tempo médio de resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byChannel.map((c) => (
                <TableRow key={c.channelName}>
                  <TableCell className="font-medium">
                    {c.channelName}
                    <span className="text-muted-foreground font-normal"> · {c.channelType}</span>
                  </TableCell>
                  <TableCell>
                    {c.channelStatus === "CONNECTED" ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-600/40">
                        Conectado
                      </Badge>
                    ) : c.channelStatus ? (
                      <Badge variant="destructive">Desconectado</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{c.total}</TableCell>
                  <TableCell className="text-right">
                    {c.nuncaRespondido > 0 ? <Badge variant="destructive">{c.nuncaRespondido}</Badge> : "0"}
                  </TableCell>
                  <TableCell className="text-right">{formatMinutes(c.avgResponseMinutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {multiChannelContacts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users2 className="h-4 w-4 text-primary" />
            Contatos conversando em mais de um canal ({multiChannelContacts.length})
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Podem estar mandando mensagem simultaneamente pelo WhatsApp e pelo Instagram — vale unificar o
            atendimento pra não responder duplicado (ou pior, deixar um dos dois sem resposta).
          </p>
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {multiChannelContacts.map((m) => (
              <div
                key={m.contactId}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5 text-sm"
              >
                <span className="font-medium truncate">{m.contactName}</span>
                <span className="text-xs text-muted-foreground text-right shrink-0">
                  {m.channelNames.join(" + ")} · {timeSince(m.lastActivityAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {byOrigin.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
          <div className="px-4 pt-4 pb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Atendimento por origem
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Chats</TableHead>
                <TableHead className="text-right">Nunca respondidos</TableHead>
                <TableHead className="text-right">Tempo médio de resposta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byOrigin.map((o) => (
                <TableRow key={o.originName}>
                  <TableCell className="font-medium">{o.originName}</TableCell>
                  <TableCell className="text-right">{o.total}</TableCell>
                  <TableCell className="text-right">
                    {o.nuncaRespondido > 0 ? (
                      <Badge variant="destructive">{o.nuncaRespondido}</Badge>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatMinutes(o.avgResponseMinutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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

  const { overview, trends, funnel, origins, products, fontes, tags, originProductCross, insightSections, actions } =
    data;

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
          Contatos, negócios e atendimento sincronizados da Clint — cruzamentos de origem, produto e tempo
          de resposta para decisões mais assertivas.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onApply={setFilters}
        productOptions={data.productOptions}
        loading={loading}
      />

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="negocios">Negócios</TabsTrigger>
          <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
          <TabsTrigger value="origem-produto">Origem &amp; Produto</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="acoes">Ações a Tomar</TabsTrigger>
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

          <InsightSectionsPanel sections={insightSections} />

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

        <TabsContent value="negocios">
          <NegociosTab filters={filters} />
        </TabsContent>

        <TabsContent value="atendimento">
          <AtendimentoTab filters={filters} />
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

        <TabsContent value="acoes" className="space-y-4 mt-4">
          {actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ação sugerida com os dados atuais.</p>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ListChecks className="h-4 w-4" />
                Recomendações calculadas a partir dos dados sincronizados — revise antes de agir.
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {actions.map((action, i) => (
                  <ActionCard key={i} action={action} />
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
