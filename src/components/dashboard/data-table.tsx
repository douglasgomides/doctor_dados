"use client";

import { useState, useCallback } from "react";
import { CampaignRow, EDITABLE_COLUMNS, COLUMN_LABELS, READONLY_COLUMNS } from "@/types";
import { useDashboardStore } from "@/store/dashboard-store";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
  ChevronsLeft,
  ChevronsRight,
  Pencil,
  ExternalLink,
  Save,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  data: CampaignRow[];
  readOnly?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Colunas visíveis na tabela (excluindo rowIndex)
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

const STATUS_COLORS: Record<string, string> = {
  Ativo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  Pausado: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Em Análise": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Concluído: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
};

export function DataTable({ data, readOnly = false }: DataTableProps) {
  const updateRow = useDashboardStore((s) => s.updateRow);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [editingRow, setEditingRow] = useState<CampaignRow | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string | number>>({});
  const [inlineEdit, setInlineEdit] = useState<{
    rowIndex: number;
    field: keyof CampaignRow;
  } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>("");
  const [savedCells, setSavedCells] = useState<Set<string>>(new Set());

  const totalPages = Math.ceil(data.length / pageSize);
  const paginatedData = data.slice(page * pageSize, (page + 1) * pageSize);

  const isEditable = (col: keyof CampaignRow) => !readOnly && EDITABLE_COLUMNS.includes(col);

  // Inline edit handlers
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
      "orcamento",
      "seguidoresNovos",
      "custoPorSeguidor",
      "mensagensIniciadas",
      "custoPorMensagem",
      "visualizacaoDaPagina",
      "checkouts",
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

  // Modal edit handlers
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

  const formatCellValue = (row: CampaignRow, col: keyof CampaignRow) => {
    const value = row[col];
    if (col === "dia") {
      return new Date(value as string + "T12:00:00").toLocaleDateString("pt-BR");
    }
    if (
      col === "valorInvestido" ||
      col === "orcamento" ||
      col === "custoPorSeguidor" ||
      col === "custoPorMensagem"
    ) {
      return `R$ ${(value as number).toFixed(2)}`;
    }
    if (col === "impressoes" || col === "alcance" || col === "cliquesNoLink" || col === "cliquesUnicos") {
      return (value as number).toLocaleString("pt-BR");
    }
    if (col === "linkDoPost") {
      return (
        <a
          href={value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Link
        </a>
      );
    }
    return value;
  };

  return (
    <div className="space-y-4">
      {/* Table Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.length} registro{data.length !== 1 ? "s" : ""} encontrado
          {data.length !== 1 ? "s" : ""}
        </p>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(0);
          }}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[50px] text-center">#</TableHead>
                {VISIBLE_COLUMNS.map((col) => (
                  <TableHead
                    key={col}
                    className={cn(
                      "whitespace-nowrap text-xs",
                      isEditable(col) && "bg-primary/[0.03]"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      {COLUMN_LABELS[col]}
                      {isEditable(col) && (
                        <Pencil className="h-2.5 w-2.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </TableHead>
                ))}
                {!readOnly && <TableHead className="w-[60px] text-center">Editar</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={VISIBLE_COLUMNS.length + 2}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Nenhum dado encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((row) => (
                  <TableRow key={row.rowIndex} className="group">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {row.rowIndex}
                    </TableCell>
                    {VISIBLE_COLUMNS.map((col) => {
                      const isEditingThis =
                        inlineEdit?.rowIndex === row.rowIndex &&
                        inlineEdit?.field === col;
                      const cellKey = `${row.rowIndex}-${col}`;
                      const justSaved = savedCells.has(cellKey);

                      return (
                        <TableCell
                          key={col}
                          className={cn(
                            "text-sm whitespace-nowrap",
                            isEditable(col) && "cursor-pointer hover:bg-primary/[0.04]",
                            justSaved && "bg-emerald-50 dark:bg-emerald-950/20"
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
                                className="h-7 text-sm w-[120px]"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={saveInlineEdit}
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : col === "status" ? (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "font-medium text-xs",
                                STATUS_COLORS[row.status] || ""
                              )}
                            >
                              {row.status}
                            </Badge>
                          ) : justSaved ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <Check className="h-3 w-3" />
                              {formatCellValue(row, col)}
                            </span>
                          ) : (
                            formatCellValue(row, col)
                          )}
                        </TableCell>
                      );
                    })}
                    {!readOnly && (
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => openEditModal(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Página {page + 1} de {totalPages || 1}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(0)}
            disabled={page === 0}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingRow} onOpenChange={() => setEditingRow(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            {editingRow && (
              <p className="text-sm text-muted-foreground">
                {editingRow.nomeDaCampanha} -{" "}
                {new Date(editingRow.dia + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {/* Read-only info */}
            {editingRow && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
                {READONLY_COLUMNS.filter((c) => c !== "contaDeAnuncio").map((col) => (
                  <div key={col}>
                    <Label className="text-[10px] text-muted-foreground uppercase">
                      {COLUMN_LABELS[col]}
                    </Label>
                    <p className="text-sm font-medium">
                      {formatCellValue(editingRow, col)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Editable fields */}
            {EDITABLE_COLUMNS.map((col) => (
              <div key={col} className="space-y-1.5">
                <Label htmlFor={`edit-${col}`} className="text-xs">
                  {COLUMN_LABELS[col]}
                </Label>
                {col === "status" ? (
                  <Select
                    value={String(editValues[col] || "")}
                    onValueChange={(v) =>
                      setEditValues({ ...editValues, [col]: v })
                    }
                  >
                    <SelectTrigger id={`edit-${col}`} className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Ativo", "Pausado", "Em Análise", "Concluído"].map(
                        (s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                ) : col === "tipo" ? (
                  <Select
                    value={String(editValues[col] || "")}
                    onValueChange={(v) =>
                      setEditValues({ ...editValues, [col]: v })
                    }
                  >
                    <SelectTrigger id={`edit-${col}`} className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Imagem", "Vídeo", "Carrossel", "Stories", "Reels"].map(
                        (t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={`edit-${col}`}
                    type={
                      [
                        "orcamento",
                        "seguidoresNovos",
                        "custoPorSeguidor",
                        "mensagensIniciadas",
                        "custoPorMensagem",
                        "visualizacaoDaPagina",
                        "checkouts",
                      ].includes(col)
                        ? "number"
                        : "text"
                    }
                    value={editValues[col] ?? ""}
                    onChange={(e) =>
                      setEditValues({
                        ...editValues,
                        [col]:
                          e.target.type === "number"
                            ? parseFloat(e.target.value) || 0
                            : e.target.value,
                      })
                    }
                    className="h-9"
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEditModal}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
