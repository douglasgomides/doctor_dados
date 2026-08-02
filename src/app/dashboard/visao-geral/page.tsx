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
  AlertTriangle,
  ShieldAlert,
  XCircle,
  Users2,
  ClipboardCheck,
  Loader2,
  Sparkles,
} from "lucide-react";
import { STATUS_TIER_EMOJI } from "@/lib/status-tier";
import { FeedItem, ReuniaoValidacaoRow, ConteudoValidacaoRow } from "@/types";

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

  const filtro = <T extends { cliente: string }>(items: T[]) =>
    cliente === "todos" ? items : items.filter((i) => i.cliente === cliente);

  const feedFiltrado = useMemo(() => {
    if (!overview) return [];
    return cliente === "todos"
      ? overview.feed
      : overview.feed.filter((f) => f.data.cliente === cliente);
  }, [overview, cliente]);

  const clientesFiltrados = useMemo(() => {
    if (!overview) return [];
    return cliente === "todos"
      ? overview.clientes
      : overview.clientes.filter((c) => c.cliente === cliente);
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

  const reunioesIncompletas = filtro(overview.alerts.reunioesIncompletas);
  const riscosAbertos = filtro(overview.alerts.riscosAbertos);
  const conteudoReprovado = filtro(overview.alerts.conteudoReprovado);

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
      <div className="grid gap-4 sm:grid-cols-3">
        <AlertCard
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Reuniões incompletas"
          count={reunioesIncompletas.length}
          items={reunioesIncompletas.map((r) => ({
            key: r.id,
            label: r.cliente,
            detail: formatDate(r.createdAt),
          }))}
        />
        <AlertCard
          icon={<ShieldAlert className="h-4 w-4" />}
          title="Riscos em aberto"
          count={riscosAbertos.length}
          items={riscosAbertos.map((r, i) => ({
            key: `${r.cliente}-${i}`,
            label: r.cliente,
            detail: r.descricao,
          }))}
        />
        <AlertCard
          icon={<XCircle className="h-4 w-4" />}
          title="Conteúdo reprovado"
          count={conteudoReprovado.length}
          items={conteudoReprovado.map((c) => ({
            key: c.id,
            label: c.cliente,
            detail: c.pecaNome || c.tipo,
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
                <TableHead>Última reunião</TableHead>
                <TableHead>Última entrega</TableHead>
                <TableHead>Riscos</TableHead>
                <TableHead className="text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesFiltrados.map((c) => (
                <TableRow key={c.cliente}>
                  <TableCell className="font-medium">{c.cliente}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.ultimaReuniao ? (
                      <>
                        {STATUS_TIER_EMOJI[c.ultimaReuniao.statusTier]} {formatDate(c.ultimaReuniao.data)}
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">sem registro</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.ultimoConteudo ? (
                      <>
                        {STATUS_TIER_EMOJI[c.ultimoConteudo.statusTier]} {formatDate(c.ultimoConteudo.data)}
                      </>
                    ) : (
                      <span className="text-muted-foreground/50">sem registro</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.riscosAbertos > 0 ? "destructive" : "outline"}>
                      {c.riscosAbertos}
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
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                  <span className="text-sm font-medium">{item.data.cliente}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.type === "reuniao" ? "Reunião" : "Conteúdo"}
                  </span>
                  <span className="text-xs">{STATUS_TIER_EMOJI[item.data.statusTier]}</span>
                  <span className="text-xs text-muted-foreground/60 ml-auto">
                    {formatDate(item.data.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {item.type === "reuniao"
                    ? item.data.resumo || "Sem resumo."
                    : item.data.feedback || item.data.pecaNome || "Sem feedback."}
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
          {detalhe && detalhe.type === "reuniao" && (
            <ReuniaoDetalhe reuniao={detalhe.data} />
          )}
          {detalhe && detalhe.type === "conteudo" && (
            <ConteudoDetalhe conteudo={detalhe.data} />
          )}
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

function ReuniaoDetalhe({ reuniao }: { reuniao: ReuniaoValidacaoRow }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading">
          {reuniao.cliente} {STATUS_TIER_EMOJI[reuniao.statusTier]}
        </DialogTitle>
        <DialogDescription>
          {reuniao.arquivoNome || "Reunião"} · {formatDate(reuniao.createdAt)} · status: {reuniao.status}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        {reuniao.resumo && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Resumo</p>
            <p>{reuniao.resumo}</p>
          </div>
        )}
        {reuniao.compromissos.length > 0 && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Compromissos</p>
            <ul className="space-y-1">
              {reuniao.compromissos.map((c, i) => (
                <li key={i}>
                  • {c.descricao}
                  {c.responsavel && <span className="text-muted-foreground"> ({c.responsavel})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {reuniao.riscos.length > 0 && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Riscos</p>
            <ul className="space-y-1">
              {reuniao.riscos.map((r, i) => (
                <li key={i}>
                  • {r.descricao}
                  {r.responsavel ? (
                    <span className="text-muted-foreground"> ({r.responsavel})</span>
                  ) : (
                    <span className="text-destructive/80"> — sem responsável</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {reuniao.pautaProxima && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
              Pauta sugerida para a próxima
            </p>
            <p>{reuniao.pautaProxima}</p>
          </div>
        )}
        {reuniao.recapMensagem && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
              Recap (mensagem ao cliente)
            </p>
            <p className="whitespace-pre-wrap">{reuniao.recapMensagem}</p>
          </div>
        )}
      </div>
    </>
  );
}

function ConteudoDetalhe({ conteudo }: { conteudo: ConteudoValidacaoRow }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading">
          {conteudo.cliente} {STATUS_TIER_EMOJI[conteudo.statusTier]}
        </DialogTitle>
        <DialogDescription>
          {conteudo.pecaNome || conteudo.tipo} · {formatDate(conteudo.createdAt)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="flex gap-4">
          {conteudo.statusTexto && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Texto</p>
              <p>{conteudo.statusTexto}</p>
            </div>
          )}
          {conteudo.statusArte && (
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Arte</p>
              <p>{conteudo.statusArte}</p>
            </div>
          )}
        </div>
        {conteudo.feedback && (
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Feedback</p>
            <p className="whitespace-pre-wrap">{conteudo.feedback}</p>
          </div>
        )}
      </div>
    </>
  );
}
