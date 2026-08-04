"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useComercialStore } from "@/store/comercial-store";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Briefcase,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ThumbsUp,
  Lightbulb,
  TrendingUp,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { ComercialAnalise, ComercialResultado, COMERCIAL_RESULTADO_LABELS } from "@/types";
import { URGENTE_HORAS, horasDesde } from "@/lib/constants";
import Link from "next/link";

type Aba = "aprovados" | "ajustar" | "todos";

export default function ComercialPage() {
  return (
    <Suspense fallback={null}>
      <ComercialPageInner />
    </Suspense>
  );
}

function ComercialPageInner() {
  const currentUser = useAuthStore((s) => s.user);
  const { analises, loading, fetchAnalises } = useComercialStore();
  const [selected, setSelected] = useState<ComercialAnalise | null>(null);
  const [aba, setAba] = useState<Aba>("todos");
  const [busca, setBusca] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    fetchAnalises();
  }, [fetchAnalises]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || analises.length === 0) return;
    const alvo = analises.find((a) => a.id === id);
    if (alvo) {
      setSelected(alvo);
      router.replace("/dashboard/comercial", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, analises.length]);

  const filtradas = useMemo(() => {
    let lista = analises;
    if (aba === "aprovados") lista = analises.filter((a) => a.status === "aprovado");
    else if (aba === "ajustar") lista = analises.filter((a) => a.status === "ajustar");

    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (a) =>
          (a.titulo || "").toLowerCase().includes(q) ||
          a.participantes.join(", ").toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [analises, aba, busca]);

  if (currentUser?.role !== "master") {
    redirect("/dashboard/visao-geral");
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Comercial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Calls de venda com leads/prospects (ainda não são clientes) — diferente das mentorias
            em <span className="text-foreground/80">Reuniões</span>. Análise automática, importada
            da transcrição do Meet.
          </p>
        </div>
        <Link
          href="/dashboard/comercial/insights"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0 mt-1"
        >
          <TrendingUp className="h-4 w-4" />
          Relatório de padrões
        </Link>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Calls analisadas</CardTitle>
          </div>
          <CardDescription>
            {filtradas.length} de {analises.length} call{analises.length !== 1 ? "s" : ""} importada
            {analises.length !== 1 ? "s" : ""} automaticamente
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
              <TabsList>
                <TabsTrigger value="todos">Todas</TabsTrigger>
                <TabsTrigger value="aprovados">Aprovadas</TabsTrigger>
                <TabsTrigger value="ajustar">Ajustar</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por título, participante ou transcrição..."
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Data</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="w-[80px] text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => setSelected(a)}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                      {a.status === "ajustar" && <EsperaBadge createdAt={a.createdAt} />}
                    </TableCell>
                    <TableCell className="font-medium max-w-[220px] truncate">
                      {a.titulo || "Sem título"}
                      {a.isTest && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                          demo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                      {a.participantes.join(", ")}
                    </TableCell>
                    <TableCell className="text-sm">{a.score}/100</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <ResultadoSelect analise={a} compact />
                    </TableCell>
                    <TableCell className="text-center">
                      <FileText className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
                {filtradas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {loading
                        ? "Carregando..."
                        : analises.length === 0
                          ? "Nenhuma call comercial analisada ainda."
                          : "Nenhuma call encontrada com esse filtro."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <ComercialDetalhe analise={selected} onClose={() => setSelected(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EsperaBadge({ createdAt }: { createdAt: string }) {
  const horas = horasDesde(createdAt);
  const urgente = horas >= URGENTE_HORAS;
  const texto = horas < 1 ? "menos de 1h" : `${Math.floor(horas)}h`;
  return (
    <span
      className={`block text-[10px] mt-0.5 ${urgente ? "text-destructive font-medium" : "text-muted-foreground/70"}`}
    >
      esperando há {texto}
    </span>
  );
}

function StatusBadge({ status }: { status: ComercialAnalise["status"] }) {
  return status === "aprovado" ? (
    <Badge className="!bg-emerald-600 !text-white">Aprovado</Badge>
  ) : (
    <Badge variant="destructive">Precisa de ajuste</Badge>
  );
}

const RESULTADO_NONE = "none";

function ResultadoSelect({ analise, compact }: { analise: ComercialAnalise; compact?: boolean }) {
  const updateResultado = useComercialStore((s) => s.updateResultado);
  const [valor, setValor] = useState(analise.valorFechado?.toString() || "");
  const [showValor, setShowValor] = useState(analise.resultado === "fechou");

  async function handleChange(value: string) {
    const resultado = value === RESULTADO_NONE ? null : (value as ComercialResultado);
    setShowValor(resultado === "fechou");
    await updateResultado(analise.id, resultado, resultado === "fechou" ? analise.valorFechado : null);
  }

  async function handleValorBlur() {
    const numero = valor.trim() ? Number(valor) : null;
    if (numero === analise.valorFechado) return;
    await updateResultado(analise.id, analise.resultado, Number.isFinite(numero) ? numero : null);
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-wrap items-center gap-2"}>
      <Select value={analise.resultado || RESULTADO_NONE} onValueChange={handleChange}>
        <SelectTrigger className={compact ? "h-8 w-[150px] text-xs" : "h-9 w-[180px]"}>
          <SelectValue placeholder="Sem retorno" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={RESULTADO_NONE}>Sem retorno ainda</SelectItem>
          {Object.entries(COMERCIAL_RESULTADO_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showValor && !compact && (
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground shrink-0">R$</Label>
          <Input
            type="number"
            className="h-9 w-28"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={handleValorBlur}
            placeholder="valor"
          />
        </div>
      )}
    </div>
  );
}

function ComercialDetalhe({
  analise,
  onClose,
}: {
  analise: ComercialAnalise;
  onClose: () => void;
}) {
  const updateConteudo = useComercialStore((s) => s.updateConteudo);
  const deleteAnalise = useComercialStore((s) => s.deleteAnalise);
  const errors = analise.issues.filter((i) => i.severity === "erro");
  const warnings = analise.issues.filter((i) => i.severity === "alerta");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    titulo: analise.titulo,
    participantes: analise.participantes.join(", "),
    content: analise.content,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ultimaEdicao, setUltimaEdicao] = useState<{ actorName: string | null; createdAt: string } | null>(
    null
  );

  useEffect(() => {
    fetch(`/api/audit-log/latest?entity=comercial&id=${analise.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUltimaEdicao(data?.entrada || null))
      .catch(() => setUltimaEdicao(null));
  }, [analise.id]);

  const startEdit = () => {
    setEditForm({
      titulo: analise.titulo,
      participantes: analise.participantes.join(", "),
      content: analise.content,
    });
    setError("");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!editForm.content.trim()) return;
    setSaving(true);
    setError("");
    const result = await updateConteudo(analise.id, {
      titulo: editForm.titulo,
      participantes: editForm.participantes.split(",").map((p) => p.trim()).filter(Boolean),
      content: editForm.content,
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Erro ao salvar edição.");
      return;
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Excluir esta call comercial? Essa ação não pode ser desfeita.")) return;
    const result = await deleteAnalise(analise.id);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Erro ao excluir call comercial.");
    }
  };

  if (editing) {
    return (
      <>
        <DialogHeader>
          <DialogTitle className="font-heading">Editar call comercial</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Título</Label>
            <Input
              value={editForm.titulo}
              onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Participantes (separados por vírgula)</Label>
            <Input
              value={editForm.participantes}
              onChange={(e) => setEditForm({ ...editForm, participantes: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Transcrição</Label>
            <Textarea
              value={editForm.content}
              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              className="min-h-[220px]"
            />
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !editForm.content.trim()}>
              {saving ? "Revalidando..." : "Salvar e revalidar"}
            </Button>
          </DialogFooter>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading flex items-center gap-2">
          {analise.titulo || "Call comercial"}
          {analise.status === "aprovado" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          {analise.isTest && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              demo
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription>
          {analise.participantes.join(", ")} ·{" "}
          {new Date(analise.createdAt).toLocaleString("pt-BR")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">Nota: {analise.score}/100</Badge>
          {ultimaEdicao && (
            <span className="text-xs text-muted-foreground">
              Editado por {ultimaEdicao.actorName || "alguém da equipe"} em{" "}
              {new Date(ultimaEdicao.createdAt).toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Resultado do negócio
          </p>
          <ResultadoSelect analise={analise} />
        </div>

        {analise.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum problema identificado.</p>
        ) : (
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
        )}

        {analise.pontosFortes.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-sm">Pontos fortes</span>
            </div>
            <ul className="space-y-1.5">
              {analise.pontosFortes.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analise.pontosMelhoria.length > 0 && (
          <div className="rounded-lg border border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-sm">Pontos de melhoria</span>
            </div>
            <ul className="space-y-1.5">
              {analise.pontosMelhoria.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  • {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Transcrição</p>
          <div className="rounded-md border border-border bg-muted/20 p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
            {analise.content}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir
          </Button>
        </div>
      </div>
    </>
  );
}
