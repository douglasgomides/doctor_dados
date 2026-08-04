"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useReunioesStore } from "@/store/reunioes-store";
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
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ListChecks,
  Lightbulb,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import { Reuniao, ReuniaoTipo, REUNIAO_TIPO_LABELS, ROTEIRO_FORMAT_LABELS } from "@/types";
import { URGENTE_HORAS, horasDesde } from "@/lib/constants";

// "grupo" fica de fora das opções do formulário (criação e edição): o campo
// de cliente aqui é um texto único, então não tem como representar vários
// médicos na mesma reunião manualmente — reunião em grupo só é criada pela
// importação automática do Meet, que vincula todos os clientes envolvidos
// via a tabela de junção reuniao_clientes.
const TIPO_OPTIONS: ReuniaoTipo[] = ["mentoria", "onboarding", "pontual"];
type Aba = "pendentes" | "aprovados" | "ajustar" | "todos";

export default function ReunioesPage() {
  return (
    <Suspense fallback={null}>
      <ReunioesPageInner />
    </Suspense>
  );
}

function ReunioesPageInner() {
  const user = useAuthStore((s) => s.user);
  const { reunioes, fetchReunioes, submitReuniao, reviewReuniao, deleteReuniao } =
    useReunioesStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [form, setForm] = useState({
    clientName: "",
    tipo: "mentoria" as ReuniaoTipo,
    content: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState<Reuniao | null>(null);
  const [selected, setSelected] = useState<Reuniao | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: "",
    tipo: "mentoria" as ReuniaoTipo,
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
    fetchReunioes();
  }, [fetchReunioes]);

  useEffect(() => {
    if (!selected || user?.role !== "master") {
      setUltimaEdicao(null);
      return;
    }
    fetch(`/api/audit-log/latest?entity=reuniao&id=${selected.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUltimaEdicao(data?.entrada || null))
      .catch(() => setUltimaEdicao(null));
  }, [selected, user?.role]);

  const isMaster = user?.role === "master";
  const podeEditar = (r: Reuniao | null) => !!r && (isMaster || r.authorId === user?.id);

  const filaPendentes = useMemo(
    () =>
      [...reunioes]
        .filter((r) => !r.reviewedByName)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [reunioes]
  );

  const filtrados = useMemo(() => {
    let lista = reunioes;
    if (aba === "pendentes") lista = reunioes.filter((r) => !r.reviewedByName);
    else if (aba === "aprovados") lista = reunioes.filter((r) => r.status === "aprovado");
    else if (aba === "ajustar") lista = reunioes.filter((r) => r.status === "ajustar");

    const q = busca.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (r) => r.clientName.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
      );
    }

    if (aba === "pendentes") {
      lista = [...lista].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return lista;
  }, [reunioes, aba, busca]);

  const handleSubmit = async () => {
    if (!form.clientName.trim() || !form.content.trim()) return;
    setSubmitting(true);
    setError("");
    const result = await submitReuniao(form);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error || "Erro ao validar reunião.");
      return;
    }
    setLastResult(result.reuniao || null);
    setForm({ clientName: form.clientName, tipo: form.tipo, content: "" });
  };

  const openReview = (reuniao: Reuniao) => {
    setSelected(reuniao);
    setReviewNote(reuniao.reviewNote || "");
    setEditing(false);
    setEditError("");
  };

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id || reunioes.length === 0) return;
    const alvo = reunioes.find((r) => r.id === id);
    if (alvo) {
      openReview(alvo);
      router.replace("/dashboard/reunioes", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, reunioes.length]);

  const irNaFila = (direcao: 1 | -1) => {
    if (!selected) return;
    const idx = filaPendentes.findIndex((r) => r.id === selected.id);
    if (idx === -1) return;
    const proximo = filaPendentes[idx + direcao];
    if (proximo) openReview(proximo);
  };

  const handleReview = async (status: Reuniao["status"]) => {
    if (!selected) return;
    const idx = filaPendentes.findIndex((r) => r.id === selected.id);
    const result = await reviewReuniao(selected.id, { status, reviewNote });
    if (!result.success) {
      setEditError(result.error || "Erro ao revisar reunião.");
      return;
    }
    const proximo = idx !== -1 ? filaPendentes[idx + 1] : undefined;
    if (proximo) {
      openReview(proximo);
    } else {
      setSelected(null);
    }
  };

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
    setEditForm({ clientName: selected.clientName, tipo: selected.tipo, content: selected.content });
    setEditError("");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    if (!editForm.clientName.trim() || !editForm.content.trim()) return;
    setSavingEdit(true);
    setEditError("");
    const result = await reviewReuniao(selected.id, editForm);
    setSavingEdit(false);
    if (!result.success) {
      setEditError(result.error || "Erro ao salvar edição.");
      return;
    }
    const atualizado = useReunioesStore.getState().reunioes.find((r) => r.id === selected.id);
    if (atualizado) setSelected(atualizado);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm("Excluir esta reunião? Essa ação não pode ser desfeita.")) return;
    const result = await deleteReuniao(selected.id);
    if (result.success) {
      setSelected(null);
    } else {
      setEditError(result.error || "Erro ao excluir reunião.");
    }
  };

  const pendentesCount = filaPendentes.length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Validador de Reuniões</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Mentorias com médicos que já são clientes — não confundir com as calls de venda de{" "}
          <span className="text-foreground/80">Comercial</span>. Cole a transcrição do Meet depois
          da reunião e veja se ela cobriu o essencial, mesmo quando você não estava nela.
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Nova reunião</CardTitle>
          </div>
          <CardDescription>Cole a transcrição gerada pelo Google Meet.</CardDescription>
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
              <Label className="text-xs">Tipo de reunião</Label>
              <Select
                value={form.tipo}
                onValueChange={(v: ReuniaoTipo) => setForm({ ...form, tipo: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {REUNIAO_TIPO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Transcrição da reunião</Label>
            <Textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Cole aqui a transcrição gerada pelo Google Meet..."
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
            {submitting ? "Validando..." : "Validar reunião"}
          </Button>

          {lastResult && <ValidationResult reuniao={lastResult} />}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">
              {isMaster ? "Todas as reuniões registradas" : "Suas reuniões registradas"}
            </CardTitle>
          </div>
          <CardDescription>
            {filtrados.length} de {reunioes.length} reunião{reunioes.length !== 1 ? "ões" : ""}
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
                placeholder="Buscar por cliente ou transcrição..."
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
                  <TableHead>Tipo</TableHead>
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
                    <TableCell>{REUNIAO_TIPO_LABELS[r.tipo]}</TableCell>
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
                      {reunioes.length === 0
                        ? "Nenhuma reunião registrada ainda."
                        : "Nenhuma reunião encontrada com esse filtro."}
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
                  {selected.clientName} — {REUNIAO_TIPO_LABELS[selected.tipo]}
                  {selected.isTest && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                      demo
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Registrado por {selected.authorName} em{" "}
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
                      <Label className="text-xs">Tipo de reunião</Label>
                      <Select
                        value={editForm.tipo}
                        onValueChange={(v: ReuniaoTipo) => setEditForm({ ...editForm, tipo: v })}
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {editForm.tipo === "grupo" && (
                            <SelectItem value="grupo" disabled>
                              {REUNIAO_TIPO_LABELS.grupo} (automático)
                            </SelectItem>
                          )}
                          {TIPO_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {REUNIAO_TIPO_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editForm.tipo === "grupo" && (
                        <p className="text-[11px] text-muted-foreground">
                          Reunião em grupo veio da importação automática (vários clientes
                          vinculados). Trocar aqui não desfaz o vínculo, mas trocar o campo
                          &quot;Médico/Cliente&quot; ao lado sim.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Transcrição</Label>
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
                  <ValidationResult reuniao={selected} />

                  <div className="space-y-1.5">
                    <Label className="text-xs">Transcrição</Label>
                    <div className="rounded-md border border-border/50 bg-muted/20 p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                      {selected.content}
                    </div>
                  </div>

                  {isMaster && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nota de revisão (visível para quem registrou)</Label>
                      <Textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="Ex: Faltou marcar a próxima reunião com data."
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

function StatusBadge({ status }: { status: Reuniao["status"] }) {
  return status === "aprovado" ? (
    <Badge className="!bg-emerald-600 !text-white">Aprovado</Badge>
  ) : (
    <Badge variant="destructive">Precisa de ajuste</Badge>
  );
}

function ValidationResult({ reuniao }: { reuniao: Reuniao }) {
  const errors = reuniao.issues.filter((i) => i.severity === "erro");
  const warnings = reuniao.issues.filter((i) => i.severity === "alerta");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {reuniao.status === "aprovado" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <span className="font-medium text-sm">
              {reuniao.status === "aprovado" ? "Aprovado" : "Precisa de ajuste"}
            </span>
          </div>
          <Badge variant="outline">Nota: {reuniao.score}/100</Badge>
        </div>

        {reuniao.issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum problema identificado nesta reunião.
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

      {reuniao.suggestedAgenda.length > 0 && (
        <div className="rounded-lg border border-border/50 p-4 space-y-2">
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
        <div className="rounded-lg border border-border/50 p-4 space-y-2">
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
    </div>
  );
}
