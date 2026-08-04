"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useRoteirosStore } from "@/store/roteiros-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { Roteiro, RoteiroFormat, ROTEIRO_FORMAT_LABELS } from "@/types";
import { URGENTE_HORAS, horasDesde } from "@/lib/constants";

const FORMAT_OPTIONS: RoteiroFormat[] = ["reel", "carrossel", "stories"];
type Aba = "pendentes" | "aprovados" | "ajustar" | "todos";

export default function RoteirosPage() {
  return (
    <Suspense fallback={null}>
      <RoteirosPageInner />
    </Suspense>
  );
}

function RoteirosPageInner() {
  const user = useAuthStore((s) => s.user);
  const { roteiros, loading, fetchRoteiros, submitRoteiro, reviewRoteiro, deleteRoteiro } =
    useRoteirosStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [form, setForm] = useState({
    clientName: "",
    format: "reel" as RoteiroFormat,
    title: "",
    content: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<Roteiro | null>(null);
  const [selected, setSelected] = useState<Roteiro | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: "",
    format: "reel" as RoteiroFormat,
    title: "",
    content: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [aba, setAba] = useState<Aba>("pendentes");
  const [busca, setBusca] = useState("");
  const [ultimaEdicao, setUltimaEdicao] = useState<{ actorName: string | null; createdAt: string } | null>(
    null
  );

  useEffect(() => {
    fetchRoteiros();
  }, [fetchRoteiros]);

  // Quem editou esse roteiro por último (fora do fluxo de revisão, que já
  // tem seu próprio rastro em reviewedByName) — trilha de auditoria criada
  // pra dar visibilidade de "alguém mexeu nisso" sem precisar perguntar.
  useEffect(() => {
    if (!selected || user?.role !== "master") {
      setUltimaEdicao(null);
      return;
    }
    fetch(`/api/audit-log/latest?entity=roteiro&id=${selected.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUltimaEdicao(data?.entrada || null))
      .catch(() => setUltimaEdicao(null));
  }, [selected, user?.role]);

  const isMaster = user?.role === "master";
  const podeEditar = (r: Roteiro | null) =>
    !!r && (isMaster || r.authorId === user?.id);

  // Fila real de "ainda não foi revisado por um humano" — independe de qual
  // aba está selecionada na tela, é o que orienta a navegação em sequência
  // (Próximo/Anterior, avançar automático ao decidir) e os atalhos de
  // teclado. Ordenada do mais antigo pro mais novo, igual à prioridade que
  // o alerta de WhatsApp já usa.
  const filaPendentes = useMemo(
    () =>
      [...roteiros]
        .filter((r) => !r.reviewedByName)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [roteiros]
  );

  const filtrados = useMemo(() => {
    let lista = roteiros;
    if (aba === "pendentes") lista = roteiros.filter((r) => !r.reviewedByName);
    else if (aba === "aprovados") lista = roteiros.filter((r) => r.status === "aprovado");
    else if (aba === "ajustar") lista = roteiros.filter((r) => r.status === "ajustar");

    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (r) =>
          r.clientName.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.content.toLowerCase().includes(q)
      );
    }

    if (aba === "pendentes") {
      lista = [...lista].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return lista;
  }, [roteiros, aba, busca]);

  const openReview = (roteiro: Roteiro) => {
    setSelected(roteiro);
    setReviewNote(roteiro.reviewNote || "");
    setEditing(false);
    setEditError("");
  };

  // Deep link: ?id=<roteiroId> abre o registro certo direto, usado pela
  // Central de Pendências e por qualquer link mandado internamente.
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || roteiros.length === 0) return;
    const alvo = roteiros.find((r) => r.id === id);
    if (alvo) {
      openReview(alvo);
      router.replace("/dashboard/roteiros", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, roteiros.length]);

  const handleSubmit = async () => {
    if (!form.clientName.trim() || !form.content.trim()) return;
    setSubmitting(true);
    setError("");
    const result = await submitRoteiro(form);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || "Erro ao validar roteiro.");
      return;
    }
    setLastResult(result.roteiro || null);
    setForm({ clientName: form.clientName, format: form.format, title: "", content: "" });
  };

  const irNaFila = (direcao: 1 | -1) => {
    if (!selected) return;
    const idx = filaPendentes.findIndex((r) => r.id === selected.id);
    if (idx === -1) return;
    const proximo = filaPendentes[idx + direcao];
    if (proximo) openReview(proximo);
  };

  const handleReview = async (status: Roteiro["status"]) => {
    if (!selected) return;
    const idx = filaPendentes.findIndex((r) => r.id === selected.id);
    const result = await reviewRoteiro(selected.id, { status, reviewNote });
    if (!result.success) {
      setEditError(result.error || "Erro ao revisar roteiro.");
      return;
    }
    // Avança pro próximo item pendente da fila em vez de fechar o modal —
    // evita o ciclo de reabrir a tabela e procurar a linha certa de novo.
    const proximo = idx !== -1 ? filaPendentes[idx + 1] : undefined;
    if (proximo) {
      openReview(proximo);
    } else {
      setSelected(null);
    }
  };

  // Atalhos de teclado enquanto o modal de revisão está aberto: A = aprovar,
  // J = pedir ajuste, N/→ = próximo sem decidir, ← = anterior. Ignorado
  // enquanto o foco está num campo de texto (ex: escrevendo a nota de
  // revisão) pra não disparar sem querer.
  useEffect(() => {
    if (!selected || editing || !isMaster) return;
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        handleReview("aprovado");
      } else if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        handleReview("ajustar");
      } else if (e.key === "n" || e.key === "N" || e.key === "ArrowRight") {
        e.preventDefault();
        irNaFila(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        irNaFila(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editing, isMaster, filaPendentes, reviewNote]);

  const startEdit = () => {
    if (!selected) return;
    setEditForm({
      clientName: selected.clientName,
      format: selected.format,
      title: selected.title,
      content: selected.content,
    });
    setEditError("");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    if (!editForm.clientName.trim() || !editForm.content.trim()) return;
    setSavingEdit(true);
    setEditError("");
    const result = await reviewRoteiro(selected.id, editForm);
    setSavingEdit(false);
    if (!result.success) {
      setEditError(result.error || "Erro ao salvar edição.");
      return;
    }
    const atualizado = useRoteirosStore.getState().roteiros.find((r) => r.id === selected.id);
    if (atualizado) setSelected(atualizado);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm("Excluir este roteiro? Essa ação não pode ser desfeita.")) return;
    const result = await deleteRoteiro(selected.id);
    if (result.success) {
      setSelected(null);
    } else {
      setEditError(result.error || "Erro ao excluir roteiro.");
    }
  };

  const pendentesCount = filaPendentes.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Validador de Roteiros</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Cole o roteiro de Reels, carrossel ou Stories antes de enviar e veja na hora o que
          precisa de ajuste.
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Novo roteiro</CardTitle>
          </div>
          <CardDescription>Preencha os dados e valide antes de enviar para revisão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Médico / Cliente</Label>
              <Input
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                placeholder="Ex: Dra. Juliana Paola"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Formato</Label>
              <Select
                value={form.format}
                onValueChange={(v: RoteiroFormat) => setForm({ ...form, format: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {ROTEIRO_FORMAT_LABELS[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Título / Tema (opcional)</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: 3 sinais de que você precisa de um check-up hormonal"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Roteiro completo
              {form.format === "reel" && " (use \"Gancho:\", \"Corpo:\" e \"CTA:\" para marcar as seções)"}
              {form.format === "carrossel" && " (numere os slides, ex: \"Slide 1\", \"Slide 2\"...)"}
              {form.format === "stories" && " (numere os frames, ex: \"Frame 1\", \"Frame 2\"...)"}
            </Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Cole o roteiro completo aqui..."
              className="min-h-[220px]"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.clientName.trim() || !form.content.trim()}
          >
            {submitting ? "Validando..." : "Validar e enviar"}
          </Button>

          {lastResult && <ValidationResult roteiro={lastResult} />}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              {isMaster ? "Todos os roteiros enviados" : "Seus roteiros enviados"}
            </CardTitle>
          </div>
          <CardDescription>
            {filtrados.length} de {roteiros.length} roteiro{roteiros.length !== 1 ? "s" : ""}
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
              <TabsList>
                <TabsTrigger value="pendentes">Pendentes ({pendentesCount})</TabsTrigger>
                <TabsTrigger value="aprovados">Aprovados</TabsTrigger>
                <TabsTrigger value="ajustar">Ajustar</TabsTrigger>
                <TabsTrigger value="todos">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cliente, título ou conteúdo..."
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Formato</TableHead>
                  {isMaster && <TableHead>Autor</TableHead>}
                  <TableHead>Nota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openReview(r)}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                      {!r.reviewedByName && <EsperaBadge createdAt={r.createdAt} />}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.clientName}
                      {r.isTest && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 h-4">
                          demo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{ROTEIRO_FORMAT_LABELS[r.format]}</TableCell>
                    {isMaster && <TableCell className="text-sm">{r.authorName}</TableCell>}
                    <TableCell className="text-sm">{r.score}/100</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isMaster ? 7 : 6} className="text-center text-muted-foreground py-8">
                      {loading
                        ? "Carregando..."
                        : roteiros.length === 0
                          ? "Nenhum roteiro enviado ainda."
                          : "Nenhum roteiro encontrado com esse filtro."}
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
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.title || `${ROTEIRO_FORMAT_LABELS[selected.format]} sem título`}
                  {selected.isTest && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      demo
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selected.clientName} · {ROTEIRO_FORMAT_LABELS[selected.format]} · enviado por{" "}
                  {selected.authorName} em{" "}
                  {new Date(selected.createdAt).toLocaleString("pt-BR")}
                  {isMaster && !editing && filaPendentes.length > 1 && !selected.reviewedByName && (
                    <span className="block mt-1 text-[11px]">
                      Atalhos: A aprovar · J pedir ajuste · N próximo · fila com{" "}
                      {filaPendentes.length} pendente{filaPendentes.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {editing ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Médico / Cliente</Label>
                      <Input
                        value={editForm.clientName}
                        onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Formato</Label>
                      <Select
                        value={editForm.format}
                        onValueChange={(v: RoteiroFormat) => setEditForm({ ...editForm, format: v })}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMAT_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f}>
                              {ROTEIRO_FORMAT_LABELS[f]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Título / Tema</Label>
                    <Input
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Roteiro completo</Label>
                    <Textarea
                      value={editForm.content}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      className="min-h-[220px]"
                    />
                  </div>
                  {editError && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                      {editError}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={savingEdit}>
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      disabled={savingEdit || !editForm.clientName.trim() || !editForm.content.trim()}
                    >
                      {savingEdit ? "Revalidando..." : "Salvar e revalidar"}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <>
                  <ValidationResult roteiro={selected} />

                  <div className="space-y-1.5">
                    <Label className="text-xs">Conteúdo do roteiro</Label>
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {selected.content}
                    </div>
                  </div>

                  {isMaster && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nota de revisão (visível para quem enviou)</Label>
                      <Textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Ex: Ajustar o gancho, está genérico demais."
                        className="min-h-[80px]"
                      />
                    </div>
                  )}

                  {selected.reviewedByName && (
                    <p className="text-xs text-muted-foreground">
                      Revisado por {selected.reviewedByName} em{" "}
                      {selected.reviewedAt && new Date(selected.reviewedAt).toLocaleString("pt-BR")}
                      {selected.reviewNote ? `: "${selected.reviewNote}"` : ""}
                    </p>
                  )}

                  {ultimaEdicao && (
                    <p className="text-xs text-muted-foreground">
                      Editado por {ultimaEdicao.actorName || "alguém da equipe"} em{" "}
                      {new Date(ultimaEdicao.createdAt).toLocaleString("pt-BR")}
                    </p>
                  )}

                  {editError && (
                    <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                      {editError}
                    </div>
                  )}

                  <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                    {podeEditar(selected) && (
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
                    )}
                    {isMaster && (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => handleReview("ajustar")}>
                          Pedir ajuste
                        </Button>
                        <Button onClick={() => handleReview("aprovado")}>Aprovar</Button>
                      </div>
                    )}
                  </DialogFooter>
                </>
              )}
            </>
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

function StatusBadge({ status }: { status: Roteiro["status"] }) {
  return status === "aprovado" ? (
    <Badge className="!bg-emerald-600 !text-white">Aprovado</Badge>
  ) : (
    <Badge variant="destructive">Precisa de ajuste</Badge>
  );
}

function ValidationResult({ roteiro }: { roteiro: Roteiro }) {
  const errors = roteiro.issues.filter((i) => i.severity === "erro");
  const warnings = roteiro.issues.filter((i) => i.severity === "alerta");

  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {roteiro.status === "aprovado" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <span className="font-medium text-sm">
            {roteiro.status === "aprovado" ? "Aprovado" : "Precisa de ajuste"}
          </span>
        </div>
        <Badge variant="outline">Nota: {roteiro.score}/100</Badge>
      </div>

      {roteiro.issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum problema estrutural ou de compliance identificado.
        </p>
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
    </div>
  );
}
