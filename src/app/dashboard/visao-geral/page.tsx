"use client";

import { useEffect, useMemo, useState } from "react";
import { useOverviewStore } from "@/store/overview-store";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Users2,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ListChecks,
  Lightbulb,
  Contact,
  AlertOctagon,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { STATUS_TIER_EMOJI, scoreToTier } from "@/lib/status-tier";
import { FeedItem, Roteiro, Reuniao, ROTEIRO_FORMAT_LABELS, REUNIAO_TIPO_LABELS } from "@/types";

const SPARKLINE_DAYS = 14;
const STATUS_GOOD = "#1a9c6d";
const STATUS_BAD = "#c8503b";

function diaISO(iso: string) {
  return iso.slice(0, 10);
}

// Últimos N dias (incluindo hoje), no formato AAAA-MM-DD, mais antigo primeiro.
function ultimosDias(n: number): string[] {
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

function serieDiaria(items: { createdAt: string }[]): { dia: string; valor: number }[] {
  const contagem = new Map<string, number>();
  for (const item of items) {
    const dia = diaISO(item.createdAt);
    contagem.set(dia, (contagem.get(dia) || 0) + 1);
  }
  return ultimosDias(SPARKLINE_DAYS).map((dia) => ({ dia, valor: contagem.get(dia) || 0 }));
}

function variacaoSemanal(items: { createdAt: string }[]): number | null {
  const hoje = new Date();
  const seteAtras = new Date();
  seteAtras.setDate(hoje.getDate() - 7);
  const catorzeAtras = new Date();
  catorzeAtras.setDate(hoje.getDate() - 14);

  const semanaAtual = items.filter((i) => new Date(i.createdAt) > seteAtras).length;
  const semanaAnterior = items.filter(
    (i) => new Date(i.createdAt) <= seteAtras && new Date(i.createdAt) > catorzeAtras
  ).length;

  if (semanaAnterior === 0) return semanaAtual > 0 ? 100 : null;
  return Math.round(((semanaAtual - semanaAnterior) / semanaAnterior) * 100);
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
  variacao,
  serie,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  subtitle?: string;
  variacao?: number | null;
  serie?: { dia: string; valor: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      {subtitle && <p className="text-xs text-muted-foreground -mt-2">{subtitle}</p>}
      {variacao !== undefined && variacao !== null && (
        <p className={"text-xs " + (variacao >= 0 ? "text-emerald-600" : "text-destructive")}>
          {variacao >= 0 ? "↑" : "↓"} {Math.abs(variacao)}% vs. semana passada
        </p>
      )}
      {serie && (
        <div className="h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 2, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="valor"
                stroke="var(--primary)"
                strokeWidth={2}
                fill={`url(#spark-${label})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatusDonut({ aprovados, ajustar }: { aprovados: number; ajustar: number }) {
  const total = aprovados + ajustar;
  const data = [
    { name: "Aprovados", value: aprovados, color: STATUS_GOOD },
    { name: "Para ajustar", value: ajustar, color: STATUS_BAD },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
      <div className="h-28 w-28 shrink-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={38}
              outerRadius={54}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="var(--card)" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold font-heading leading-none">{total}</span>
          <span className="text-[10px] text-muted-foreground">total</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Roteiros + Reuniões
        </p>
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="font-medium">{d.value}</span>
            <span className="text-muted-foreground">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VisaoGeralPage() {
  const { overview, loading, error, fetchOverview } = useOverviewStore();
  const [cliente, setCliente] = useState("todos");
  const [detalhe, setDetalhe] = useState<FeedItem | null>(null);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const feedFiltrado = useMemo(() => {
    if (!overview) return [];
    return cliente === "todos"
      ? overview.feed
      : overview.feed.filter((f) => f.data.clientName === cliente);
  }, [overview, cliente]);

  const clientesFiltrados = useMemo(() => {
    if (!overview) return [];
    return cliente === "todos"
      ? overview.clientes
      : overview.clientes.filter((c) => c.cliente === cliente);
  }, [overview, cliente]);

  const roteirosParaAjustar = useMemo(() => {
    if (!overview) return [];
    return cliente === "todos"
      ? overview.alerts.roteirosParaAjustar
      : overview.alerts.roteirosParaAjustar.filter((r) => r.clientName === cliente);
  }, [overview, cliente]);

  const reunioesParaAjustar = useMemo(() => {
    if (!overview) return [];
    return cliente === "todos"
      ? overview.alerts.reunioesParaAjustar
      : overview.alerts.reunioesParaAjustar.filter((r) => r.clientName === cliente);
  }, [overview, cliente]);

  const roteirosFeed = useMemo(
    () => feedFiltrado.filter((f): f is { type: "roteiro"; data: Roteiro } => f.type === "roteiro"),
    [feedFiltrado]
  );
  const reunioesFeed = useMemo(
    () => feedFiltrado.filter((f): f is { type: "reuniao"; data: Reuniao } => f.type === "reuniao"),
    [feedFiltrado]
  );

  const stats = useMemo(() => {
    const roteirosItems = roteirosFeed.map((f) => f.data);
    const reunioesItems = reunioesFeed.map((f) => f.data);
    const roteirosAprovados = roteirosItems.filter((r) => r.status === "aprovado").length;
    const reunioesAprovadas = reunioesItems.filter((r) => r.status === "aprovado").length;
    const pendencias = clientesFiltrados.reduce((acc, c) => acc + c.pendentesAjuste, 0);

    return {
      roteiros: {
        total: roteirosItems.length,
        aprovados: roteirosAprovados,
        serie: serieDiaria(roteirosItems),
        variacao: variacaoSemanal(roteirosItems),
      },
      reunioes: {
        total: reunioesItems.length,
        aprovadas: reunioesAprovadas,
        serie: serieDiaria(reunioesItems),
        variacao: variacaoSemanal(reunioesItems),
      },
      clientesAtivos: clientesFiltrados.length,
      pendencias,
      donut: {
        aprovados: roteirosAprovados + reunioesAprovadas,
        ajustar:
          roteirosItems.length - roteirosAprovados + (reunioesItems.length - reunioesAprovadas),
      },
    };
  }, [roteirosFeed, reunioesFeed, clientesFiltrados]);

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Carregando visão geral...</span>
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

  if (!overview) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header + filtro de cliente */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 font-heading">
            <Sparkles className="h-5 w-5 text-primary" />
            Visão Geral
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Todos os clientes, sem precisar entrar em cada um
          </p>
        </div>
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {overview.clientes.map((c) => (
              <SelectItem key={c.cliente} value={c.cliente}>
                {c.cliente}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="atividade">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6 mt-4">
          {/* Stats gerais */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<ClipboardCheck className="h-4 w-4" />}
              label="Roteiros"
              value={stats.roteiros.total}
              subtitle={`${stats.roteiros.aprovados} aprovados`}
              variacao={stats.roteiros.variacao}
              serie={stats.roteiros.serie}
            />
            <StatCard
              icon={<Users2 className="h-4 w-4" />}
              label="Reuniões"
              value={stats.reunioes.total}
              subtitle={`${stats.reunioes.aprovadas} aprovadas`}
              variacao={stats.reunioes.variacao}
              serie={stats.reunioes.serie}
            />
            <StatCard
              icon={<Contact className="h-4 w-4" />}
              label="Clientes ativos"
              value={stats.clientesAtivos}
            />
            <StatCard
              icon={<AlertOctagon className="h-4 w-4" />}
              label="Pendências"
              value={stats.pendencias}
              subtitle={stats.pendencias > 0 ? "precisam de ajuste" : "tudo em dia"}
            />
          </div>

          {/* Distribuição de status */}
          {stats.donut.aprovados + stats.donut.ajustar > 0 && (
            <StatusDonut aprovados={stats.donut.aprovados} ajustar={stats.donut.ajustar} />
          )}

          {/* Cards de alerta */}
          <div className="grid gap-4 sm:grid-cols-2">
            <AlertCard
              icon={<ClipboardCheck className="h-4 w-4" />}
              title="Roteiros para ajustar"
              count={roteirosParaAjustar.length}
              items={roteirosParaAjustar.map((r) => ({
                key: r.id,
                label: r.clientName,
                detail: `${ROTEIRO_FORMAT_LABELS[r.format]} · nota ${r.score}/100`,
              }))}
            />
            <AlertCard
              icon={<Users2 className="h-4 w-4" />}
              title="Reuniões para ajustar"
              count={reunioesParaAjustar.length}
              items={reunioesParaAjustar.map((r) => ({
                key: r.id,
                label: r.clientName,
                detail: `${REUNIAO_TIPO_LABELS[r.tipo]} · nota ${r.score}/100`,
              }))}
            />
          </div>

          {/* Pauta sugerida para as próximas reuniões */}
          {clientesFiltrados.some((c) => c.proximaPauta.length > 0) && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-heading">
                Pauta para as próximas reuniões
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {clientesFiltrados
                  .filter((c) => c.proximaPauta.length > 0)
                  .map((c) => (
                    <div
                      key={c.cliente}
                      className="rounded-xl border border-border bg-card/40 p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{c.cliente}</span>
                      </div>
                      <ul className="space-y-1">
                        {c.proximaPauta.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Último roteiro</TableHead>
                  <TableHead>Última reunião</TableHead>
                  <TableHead>Pendências</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.map((c) => (
                  <TableRow key={c.cliente}>
                    <TableCell className="font-medium">{c.cliente}</TableCell>
                    <TableCell className="text-sm">
                      {c.responsavelName || (
                        <span className="text-destructive/80">sem responsável</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.ultimoRoteiro ? (
                        <>
                          {STATUS_TIER_EMOJI[c.ultimoRoteiro.statusTier]}{" "}
                          {formatDate(c.ultimoRoteiro.data)}
                        </>
                      ) : (
                        <span className="text-muted-foreground/50">sem registro</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.ultimaReuniao ? (
                        <>
                          {STATUS_TIER_EMOJI[c.ultimaReuniao.statusTier]}{" "}
                          {formatDate(c.ultimaReuniao.data)}
                        </>
                      ) : (
                        <span className="text-muted-foreground/50">sem registro</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.pendentesAjuste > 0 ? "destructive" : "outline"}>
                        {c.pendentesAjuste}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="outline" size="sm" onClick={() => setCliente(c.cliente)}>
                        Ver perfil
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {clientesFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum cliente com validações registradas ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="atividade" className="mt-4">
          <div className="space-y-2">
            {feedFiltrado.map((item) => (
              <button
                key={`${item.type}-${item.data.id}`}
                onClick={() => setDetalhe(item)}
                className="w-full text-left flex items-start gap-3 rounded-xl border border-border bg-card/40 hover:bg-card transition-colors p-4"
              >
                <div className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0 bg-primary/15 text-primary">
                  {item.type === "reuniao" ? (
                    <Users2 className="h-4 w-4" />
                  ) : (
                    <ClipboardCheck className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{item.data.clientName}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.type === "reuniao"
                        ? REUNIAO_TIPO_LABELS[item.data.tipo]
                        : ROTEIRO_FORMAT_LABELS[item.data.format]}
                    </span>
                    <span className="text-xs">
                      {STATUS_TIER_EMOJI[scoreToTier(item.data.status, item.data.score)]}
                    </span>
                    <span className="text-xs text-muted-foreground/60 ml-auto">
                      {formatDate(item.data.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    Nota {item.data.score}/100
                    {item.data.issues.length > 0
                      ? ` · ${item.data.issues[0].message}`
                      : " · nenhum problema identificado."}
                  </p>
                </div>
              </button>
            ))}
            {feedFiltrado.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Nenhuma validação registrada ainda.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detalhe && detalhe.type === "roteiro" && <RoteiroDetalhe roteiro={detalhe.data} />}
          {detalhe && detalhe.type === "reuniao" && <ReuniaoDetalhe reuniao={detalhe.data} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertCard({
  icon,
  title,
  count,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  items: { key: string; label: string; detail: string }[];
}) {
  const isClear = count === 0;
  return (
    <div
      className={
        "rounded-xl border p-5 space-y-3 " +
        (isClear ? "border-border bg-card/40" : "border-primary/30 bg-primary/[0.06]")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
          <span className={isClear ? undefined : "text-primary"}>{icon}</span>
          {title}
        </div>
        <span
          className={
            "text-2xl font-bold font-heading " + (isClear ? "text-muted-foreground/40" : "text-primary")
          }
        >
          {count}
        </span>
      </div>
      {isClear ? (
        <p className="text-sm text-muted-foreground/50">Tudo certo por aqui.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <li key={item.key} className="text-sm">
              <span className="font-medium">{item.label}</span>{" "}
              <span className="text-muted-foreground">— {item.detail}</span>
            </li>
          ))}
          {items.length > 3 && (
            <li className="text-xs text-muted-foreground/50">+{items.length - 3} mais</li>
          )}
        </ul>
      )}
    </div>
  );
}

function IssuesList({ issues }: { issues: Roteiro["issues"] }) {
  const errors = issues.filter((i) => i.severity === "erro");
  const warnings = issues.filter((i) => i.severity === "alerta");

  if (issues.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum problema identificado.</p>;
  }

  return (
    <ul className="space-y-2">
      {[...errors, ...warnings].map((issue, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {issue.severity === "erro" ? (
            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          )}
          <span>{issue.message}</span>
        </li>
      ))}
    </ul>
  );
}

function RoteiroDetalhe({ roteiro }: { roteiro: Roteiro }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading flex items-center gap-2">
          {roteiro.clientName}
          {roteiro.status === "aprovado" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </DialogTitle>
        <DialogDescription>
          {ROTEIRO_FORMAT_LABELS[roteiro.format]}
          {roteiro.title ? ` · ${roteiro.title}` : ""} · enviado por {roteiro.authorName} em{" "}
          {formatDate(roteiro.createdAt)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <Badge variant="outline">Nota: {roteiro.score}/100</Badge>
        <IssuesList issues={roteiro.issues} />
        {roteiro.reviewNote && (
          <p className="text-xs text-muted-foreground">
            Revisado por {roteiro.reviewedByName}
            {roteiro.reviewedAt ? ` em ${formatDate(roteiro.reviewedAt)}` : ""}: &quot;{roteiro.reviewNote}
            &quot;
          </p>
        )}
      </div>
    </>
  );
}

function ReuniaoDetalhe({ reuniao }: { reuniao: Reuniao }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading flex items-center gap-2">
          {reuniao.clientName}
          {reuniao.status === "aprovado" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </DialogTitle>
        <DialogDescription>
          {REUNIAO_TIPO_LABELS[reuniao.tipo]} · registrada por {reuniao.authorName} em{" "}
          {formatDate(reuniao.createdAt)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <Badge variant="outline">Nota: {reuniao.score}/100</Badge>
        <IssuesList issues={reuniao.issues} />
        {reuniao.suggestedAgenda.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Sugestão de pauta para a próxima reunião</span>
            </div>
            <ul className="space-y-1.5">
              {reuniao.suggestedAgenda.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {reuniao.suggestedContentIdeas.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Ideias de conteúdo a partir desta reunião</span>
            </div>
            <ul className="space-y-1.5">
              {reuniao.suggestedContentIdeas.map((idea, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 mt-0.5">
                    {ROTEIRO_FORMAT_LABELS[idea.format]}
                  </Badge>
                  <span className="text-muted-foreground">{idea.tema}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {reuniao.reviewNote && (
          <p className="text-xs text-muted-foreground">
            Revisado por {reuniao.reviewedByName}
            {reuniao.reviewedAt ? ` em ${formatDate(reuniao.reviewedAt)}` : ""}: &quot;{reuniao.reviewNote}
            &quot;
          </p>
        )}
      </div>
    </>
  );
}
