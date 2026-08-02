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
} from "lucide-react";
import { STATUS_TIER_EMOJI, scoreToTier } from "@/lib/status-tier";
import { FeedItem, Roteiro, Reuniao, ROTEIRO_FORMAT_LABELS, REUNIAO_TIPO_LABELS } from "@/types";

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

      {/* Tabela de clientes */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-heading">
          Clientes
        </h2>
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
                        {STATUS_TIER_EMOJI[c.ultimoRoteiro.statusTier]} {formatDate(c.ultimoRoteiro.data)}
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">sem registro</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.ultimaReuniao ? (
                      <>
                        {STATUS_TIER_EMOJI[c.ultimaReuniao.statusTier]} {formatDate(c.ultimaReuniao.data)}
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
      </div>

      {/* Feed cronológico */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider font-heading">
          Atividade recente
        </h2>
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
      </div>

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
