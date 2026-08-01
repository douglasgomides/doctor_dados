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

const GOLD = "#D0A465";
const HEADING_STYLE = { fontFamily: "var(--font-lora)" };
const BODY_STYLE = { fontFamily: "var(--font-sora)" };

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
    <div
      className="dark rounded-2xl border border-[#D0A465]/25 bg-[#0A0A0A] p-6 md:p-8 space-y-8"
      style={BODY_STYLE}
    >
      {/* Header + filtro de cliente */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2" style={HEADING_STYLE}>
            <Sparkles className="h-5 w-5" style={{ color: GOLD }} />
            Visão Geral
          </h1>
          <p className="text-sm text-white/50 mt-0.5">
            Todos os clientes, sem precisar entrar em cada um
          </p>
        </div>
        <Select value={cliente} onValueChange={setCliente}>
          <SelectTrigger className="w-full sm:w-[240px] !bg-white/5 !border-white/10 text-white">
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
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider" style={HEADING_STYLE}>
          Clientes
        </h2>
        <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60">Cliente</TableHead>
                <TableHead className="text-white/60">Última reunião</TableHead>
                <TableHead className="text-white/60">Última entrega</TableHead>
                <TableHead className="text-white/60">Riscos</TableHead>
                <TableHead className="text-white/60 text-center">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesFiltrados.map((c) => (
                <TableRow key={c.cliente} className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-medium text-white">{c.cliente}</TableCell>
                  <TableCell className="text-white/70 text-sm">
                    {c.ultimaReuniao ? (
                      <>
                        {STATUS_TIER_EMOJI[c.ultimaReuniao.statusTier]} {formatDate(c.ultimaReuniao.data)}
                      </>
                    ) : (
                      <span className="text-white/30">sem registro</span>
                    )}
                  </TableCell>
                  <TableCell className="text-white/70 text-sm">
                    {c.ultimoConteudo ? (
                      <>
                        {STATUS_TIER_EMOJI[c.ultimoConteudo.statusTier]} {formatDate(c.ultimoConteudo.data)}
                      </>
                    ) : (
                      <span className="text-white/30">sem registro</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        c.riscosAbertos > 0
                          ? "!border-red-400/40 !text-red-300"
                          : "!border-white/15 !text-white/50"
                      }
                    >
                      {c.riscosAbertos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="!border-[#D0A465]/40 !text-[#D0A465] hover:!bg-[#D0A465]/10"
                      onClick={() => setCliente(c.cliente)}
                    >
                      Ver perfil
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {clientesFiltrados.length === 0 && (
                <TableRow className="border-white/10">
                  <TableCell colSpan={5} className="text-center text-white/40 py-8">
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
        <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider" style={HEADING_STYLE}>
          Atividade recente
        </h2>
        <div className="space-y-2">
          {feedFiltrado.map((item) => (
            <button
              key={`${item.type}-${item.data.id}`}
              onClick={() => setDetalhe(item)}
              className="w-full text-left flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors p-4"
            >
              <div
                className="flex items-center justify-center h-8 w-8 rounded-lg shrink-0"
                style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
              >
                {item.type === "reuniao" ? (
                  <Users2 className="h-4 w-4" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{item.data.cliente}</span>
                  <span className="text-xs text-white/40">
                    {item.type === "reuniao" ? "Reunião" : "Conteúdo"}
                  </span>
                  <span className="text-xs">{STATUS_TIER_EMOJI[item.data.statusTier]}</span>
                  <span className="text-xs text-white/30 ml-auto">{formatDate(item.data.createdAt)}</span>
                </div>
                <p className="text-sm text-white/50 truncate mt-0.5">
                  {item.type === "reuniao"
                    ? item.data.resumo || "Sem resumo."
                    : item.data.feedback || item.data.pecaNome || "Sem feedback."}
                </p>
              </div>
            </button>
          ))}
          {feedFiltrado.length === 0 && (
            <p className="text-center text-white/40 py-8 text-sm">
              Nenhuma validação registrada ainda.
            </p>
          )}
        </div>
      </div>

      {/* Dialog de detalhe */}
      <Dialog open={!!detalhe} onOpenChange={(open) => !open && setDetalhe(null)}>
        <DialogContent className="dark max-w-2xl max-h-[85vh] overflow-y-auto !bg-[#0D0D0D] !border-[#D0A465]/20">
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
        (isClear ? "border-white/10 bg-white/[0.02]" : "border-[#D0A465]/30 bg-[#D0A465]/[0.06]")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/70 text-xs font-medium uppercase tracking-wide">
          <span style={{ color: isClear ? undefined : GOLD }}>{icon}</span>
          {title}
        </div>
        <span
          className="text-2xl font-bold"
          style={{ ...HEADING_STYLE, color: isClear ? "rgba(255,255,255,0.3)" : GOLD }}
        >
          {count}
        </span>
      </div>
      {isClear ? (
        <p className="text-sm text-white/30">Tudo certo por aqui.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 3).map((item) => (
            <li key={item.key} className="text-sm">
              <span className="text-white font-medium">{item.label}</span>{" "}
              <span className="text-white/40">— {item.detail}</span>
            </li>
          ))}
          {items.length > 3 && (
            <li className="text-xs text-white/30">+{items.length - 3} mais</li>
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
        <DialogTitle className="text-white" style={HEADING_STYLE}>
          {reuniao.cliente} {STATUS_TIER_EMOJI[reuniao.statusTier]}
        </DialogTitle>
        <DialogDescription className="text-white/50">
          {reuniao.arquivoNome || "Reunião"} · {formatDate(reuniao.createdAt)} · status: {reuniao.status}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        {reuniao.resumo && (
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Resumo</p>
            <p className="text-white/80">{reuniao.resumo}</p>
          </div>
        )}
        {reuniao.compromissos.length > 0 && (
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Compromissos</p>
            <ul className="space-y-1">
              {reuniao.compromissos.map((c, i) => (
                <li key={i} className="text-white/80">
                  • {c.descricao}
                  {c.responsavel && <span className="text-white/40"> ({c.responsavel})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {reuniao.riscos.length > 0 && (
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Riscos</p>
            <ul className="space-y-1">
              {reuniao.riscos.map((r, i) => (
                <li key={i} className="text-white/80">
                  • {r.descricao}
                  {r.responsavel ? (
                    <span className="text-white/40"> ({r.responsavel})</span>
                  ) : (
                    <span className="text-red-300/70"> — sem responsável</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {reuniao.pautaProxima && (
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">
              Pauta sugerida para a próxima
            </p>
            <p className="text-white/80">{reuniao.pautaProxima}</p>
          </div>
        )}
        {reuniao.recapMensagem && (
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">
              Recap (mensagem ao cliente)
            </p>
            <p className="text-white/80 whitespace-pre-wrap">{reuniao.recapMensagem}</p>
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
        <DialogTitle className="text-white" style={HEADING_STYLE}>
          {conteudo.cliente} {STATUS_TIER_EMOJI[conteudo.statusTier]}
        </DialogTitle>
        <DialogDescription className="text-white/50">
          {conteudo.pecaNome || conteudo.tipo} · {formatDate(conteudo.createdAt)}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="flex gap-4">
          {conteudo.statusTexto && (
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Texto</p>
              <p className="text-white/80">{conteudo.statusTexto}</p>
            </div>
          )}
          {conteudo.statusArte && (
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Arte</p>
              <p className="text-white/80">{conteudo.statusArte}</p>
            </div>
          )}
        </div>
        {conteudo.feedback && (
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">Feedback</p>
            <p className="text-white/80 whitespace-pre-wrap">{conteudo.feedback}</p>
          </div>
        )}
      </div>
    </>
  );
}
