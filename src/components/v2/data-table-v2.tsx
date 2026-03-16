"use client";

import { useState, useCallback } from "react";
import { CampaignRow, EDITABLE_COLUMNS, COLUMN_LABELS, READONLY_COLUMNS } from "@/types";
import { useDashboardStore } from "@/store/dashboard-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  ExternalLink,
  Save,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableV2Props {
  data: CampaignRow[];
  readOnly?: boolean;
}

const VISIBLE_COLUMNS: (keyof CampaignRow)[] = [
  "dia",
  "status",
  "contaDeAnuncio",
  "nomeDaCampanha",
  "tipo",
  "orcamento",
  "valorInvestido",
  "impressoes",
  "alcance",
  "seguidoresNovos",
  "custoPorSeguidor",
  "mensagensIniciadas",
  "custoPorMensagem",
  "cliquesNoLink",
  "checkouts",
];

const STATUS_CONFIG: Record<string, { dot: string; text: string }> = {
  Ativo: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  Pausado: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  "Em Análise": { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  Concluído: { dot: "bg-gray-400", text: "text-muted-foreground" },
};

export function DataTableV2({ data, readOnly = false }: DataTableV2Props) {
  const updateRow = useDashboardStore((s) => s.updateRow);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [editingRow, setEditingRow] = useState<CampaignRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string | number>>({});
  const [inlineEdit, setInlineEdit] = useState<{
    rowIndex: number;
    field: keyof CampaignRow;
  } | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(page * pageSize, (page + 1) * pageSize);
  const isEditable = (col: keyof CampaignRow) => !readOnly && EDITABLE_COLUMNS.includes(col);

  const startInlineEdit = useCallback(
    (row: CampaignRow, field: keyof CampaignRow) => {
      if (!isEditable(field)) return;
      setInlineEdit({ rowIndex: row.rowIndex, field });
      setInlineValue(String(row[field]));
    },
    []
  );

  const saveInlineEdit = useCallback(() => {
    if (!inlineEdit) return;
    const { rowIndex, field } = inlineEdit;
    const numericFields: (keyof CampaignRow)[] = [
      "orcamento", "seguidoresNovos", "custoPorSeguidor",
      "mensagensIniciadas", "custoPorMensagem", "visualizacaoDaPagina", "checkouts",
    ];
    const value = numericFields.includes(field)
      ? parseFloat(inlineValue) || 0
      : inlineValue;

    updateRow(rowIndex, field, value);
    const key = `${rowIndex}-${field}`;
    setSavedCells((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setSavedCells((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 2000);
    setInlineEdit(null);
  }, [inlineEdit, inlineValue, updateRow]);

  const openEditModal = (row: CampaignRow) => {
    setEditingRow(row);
    const values: Record<string, string | number> = {};
    EDITABLE_COLUMNS.forEach((col) => {
      values[col] = row[col] as string | number;
    });
    setEditValues(values);
  };

  const saveEditModal = () => {
    if (!editingRow) return;
    Object.entries(editValues).forEach(([field, value]) => {
      updateRow(editingRow.rowIndex, field as keyof CampaignRow, value);
    });
    setEditingRow(null);
  };

  const formatCell = (row: CampaignRow, col: keyof CampaignRow) => {
    const v = row[col];
    if (col === "dia")
      return new Date((v as string) + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
    if (["valorInvestido", "orcamento", "custoPorSeguidor", "custoPorMensagem"].includes(col))
      return (v as number).toFixed(2);
    if (["impressoes", "alcance", "cliquesNoLink", "cliquesUnicos"].includes(col))
      return (v as number).toLocaleString("pt-BR");
    if (col === "linkDoPost")
      return (
        <a href={v as string} target="_blank" rel="noopener noreferrer" className="text-violet-500 hover:text-violet-400">
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    return v;
  };

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground font-mono">
          {data.length} registros
          <span className="text-muted-foreground/40 mx-2">|</span>
          Pág. {page + 1}/{totalPages || 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border/40"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(0, Math.min(page - 2, totalPages - 5));
            const pageNum = start + i;
            if (pageNum >= totalPages) return null;
            return (
              <Button
                key={pageNum}
                variant={pageNum === page ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-7 w-7 text-xs font-mono",
                  pageNum !== page && "border-border/40"
                )}
                onClick={() => setPage(pageNum)}
              >
                {pageNum + 1}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border/40"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/40 overflow-hidden bg-card/80 backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/30 bg-muted/20">
                {VISIBLE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    className={cn(
                      "px-3 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap",
                      isEditable(col) && "text-violet-500/70"
                    )}
                  >
                    {COLUMN_LABELS[col]}
                  </th>
                ))}
                {!readOnly && <th className="px-2 py-2.5 w-8" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={VISIBLE_COLUMNS.length + 1}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Nenhum dado encontrado.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => (
                  <tr
                    key={row.rowIndex}
                    className={cn(
                      "group transition-colors hover:bg-muted/30",
                      idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                    )}
                  >
                    {VISIBLE_COLUMNS.map((col) => {
                      const isEditingThis =
                        inlineEdit?.rowIndex === row.rowIndex && inlineEdit?.field === col;
                      const cellKey = `${row.rowIndex}-${col}`;
                      const justSaved = savedCells.has(cellKey);

                      return (
                        <td
                          key={col}
                          className={cn(
                            "px-3 py-2 whitespace-nowrap font-mono",
                            isEditable(col) && "cursor-pointer hover:bg-violet-500/5",
                            justSaved && "bg-emerald-500/10"
                          )}
                          onDoubleClick={() => startInlineEdit(row, col)}
                        >
                          {isEditingThis ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={inlineValue}
                                onChange={(e) => setInlineValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveInlineEdit();
                                  if (e.key === "Escape") setInlineEdit(null);
                                }}
                                className="h-6 text-xs w-[100px] font-mono"
                                autoFocus
                              />
                              <button
                                className="p-0.5 text-emerald-500 hover:text-emerald-400"
                                onClick={saveInlineEdit}
                              >
                                <Save className="h-3 w-3" />
                              </button>
                            </div>
                          ) : col === "status" ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-[11px] font-medium",
                                STATUS_CONFIG[row.status]?.text
                              )}
                            >
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full animate-pulse",
                                  STATUS_CONFIG[row.status]?.dot || "bg-gray-400"
                                )}
                              />
                              {row.status}
                            </span>
                          ) : justSaved ? (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <Check className="h-3 w-3" />
                              {formatCell(row, col)}
                            </span>
                          ) : (
                            <span
                              className={cn(
                                ["valorInvestido", "orcamento", "custoPorSeguidor", "custoPorMensagem"].includes(col)
                                  ? "text-foreground"
                                  : ""
                              )}
                            >
                              {["valorInvestido", "orcamento", "custoPorSeguidor", "custoPorMensagem"].includes(col) && (
                                <span className="text-muted-foreground/50 mr-0.5">R$</span>
                              )}
                              {formatCell(row, col)}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {!readOnly && (
                      <td className="px-2 py-2 text-center">
                        <button
                          className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-violet-500 hover:bg-violet-500/10 transition-all"
                          onClick={() => openEditModal(row)}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingRow} onOpenChange={() => setEditingRow(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Editar Registro</DialogTitle>
            {editingRow && (
              <p className="text-xs text-muted-foreground font-mono">
                {editingRow.nomeDaCampanha} — {editingRow.dia}
              </p>
            )}
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {editingRow && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg border border-border/30">
                {READONLY_COLUMNS.filter((c) => c !== "contaDeAnuncio").map((col) => (
                  <div key={col}>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                      {COLUMN_LABELS[col]}
                    </span>
                    <p className="text-xs font-mono font-medium">{String(editingRow[col])}</p>
                  </div>
                ))}
              </div>
            )}
            {EDITABLE_COLUMNS.map((col) => (
              <div key={col} className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {COLUMN_LABELS[col]}
                </Label>
                {col === "status" ? (
                  <Select
                    value={String(editValues[col] || "")}
                    onValueChange={(v) => setEditValues({ ...editValues, [col]: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Ativo", "Pausado", "Em Análise", "Concluído"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : col === "tipo" ? (
                  <Select
                    value={String(editValues[col] || "")}
                    onValueChange={(v) => setEditValues({ ...editValues, [col]: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Imagem", "Vídeo", "Carrossel", "Stories", "Reels"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={
                      ["orcamento", "seguidoresNovos", "custoPorSeguidor", "mensagensIniciadas", "custoPorMensagem", "visualizacaoDaPagina", "checkouts"].includes(col)
                        ? "number"
                        : "text"
                    }
                    value={editValues[col] ?? ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        [col]: e.target.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditingRow(null)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={saveEditModal} className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
