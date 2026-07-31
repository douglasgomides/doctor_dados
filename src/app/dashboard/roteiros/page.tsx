"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useRoteirosStore } from "@/store/roteiros-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ClipboardCheck, CheckCircle2, AlertTriangle, XCircle, FileText } from "lucide-react";
import { Roteiro, RoteiroFormat, ROTEIRO_FORMAT_LABELS } from "@/types";

const FORMAT_OPTIONS: RoteiroFormat[] = ["reel", "carrossel", "stories"];

export default function RoteirosPage() {
  const user = useAuthStore((s) => s.user);
  const { roteiros, fetchRoteiros, submitRoteiro, reviewRoteiro } = useRoteirosStore();

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

  useEffect(() => {
    fetchRoteiros();
  }, [fetchRoteiros]);

  const isMaster = user?.role === "master";

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

  const openReview = (roteiro: Roteiro) => {
    setSelected(roteiro);
    setReviewNote(roteiro.reviewNote || "");
  };

  const handleReview = async (status: Roteiro["status"]) => {
    if (!selected) return;
    await reviewRoteiro(selected.id, { status, reviewNote });
    setSelected(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Validador de Roteiros</h1>
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
            {roteiros.length} roteiro{roteiros.length !== 1 ? "s" : ""} registrado
            {roteiros.length !== 1 ? "s" : ""}
          </CardDescription>
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
                {roteiros.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => openReview(r)}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">{r.clientName}</TableCell>
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
                {roteiros.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isMaster ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Nenhum roteiro enviado ainda.
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
                <DialogTitle>
                  {selected.title || `${ROTEIRO_FORMAT_LABELS[selected.format]} sem título`}
                </DialogTitle>
                <DialogDescription>
                  {selected.clientName} · {ROTEIRO_FORMAT_LABELS[selected.format]} · enviado por{" "}
                  {selected.authorName} em{" "}
                  {new Date(selected.createdAt).toLocaleString("pt-BR")}
                </DialogDescription>
              </DialogHeader>

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

              {isMaster && (
                <DialogFooter>
                  <Button variant="outline" onClick={() => handleReview("ajustar")}>
                    Pedir ajuste
                  </Button>
                  <Button onClick={() => handleReview("aprovado")}>Aprovar</Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
