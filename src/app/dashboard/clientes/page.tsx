"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useClientesStore } from "@/store/clientes-store";
import { useUsersStore } from "@/store/users-store";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Cliente } from "@/types";

const NO_RESPONSAVEL = "none";
const TODOS_RESPONSAVEIS = "todos";
const TODOS_STATUS = "todos";

export default function ClientesPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { clientes, loading, fetchClientes, addCliente, updateCliente, removeCliente } = useClientesStore();
  const { users, fetchUsers } = useUsersStore();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    nome: "",
    responsavelId: NO_RESPONSAVEL,
    telefoneWhatsapp: "",
    roteirosPorSemana: "",
    reunioesPorMes: "",
    especialidade: "",
    cidade: "",
    plano: "",
  });

  const [busca, setBusca] = useState("");
  const [filtroResponsavel, setFiltroResponsavel] = useState(TODOS_RESPONSAVEIS);
  const [filtroStatus, setFiltroStatus] = useState(TODOS_STATUS);
  const [ocultarDemo, setOcultarDemo] = useState(true);

  useEffect(() => {
    fetchClientes();
    fetchUsers();
  }, [fetchClientes, fetchUsers]);

  if (currentUser?.role !== "master") {
    redirect("/dashboard/visao-geral");
  }

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      if (ocultarDemo && c.isTest) return false;
      if (busca.trim() && !c.nome.toLowerCase().includes(busca.trim().toLowerCase())) return false;
      if (filtroResponsavel !== TODOS_RESPONSAVEIS) {
        if (filtroResponsavel === NO_RESPONSAVEL) {
          if (c.responsavelId) return false;
        } else if (c.responsavelId !== filtroResponsavel) {
          return false;
        }
      }
      if (filtroStatus === "ativo" && !c.ativo) return false;
      if (filtroStatus === "inativo" && c.ativo) return false;
      return true;
    });
  }, [clientes, busca, filtroResponsavel, filtroStatus, ocultarDemo]);

  const openAdd = () => {
    setEditing(null);
    setError("");
    setForm({
      nome: "",
      responsavelId: NO_RESPONSAVEL,
      telefoneWhatsapp: "",
      roteirosPorSemana: "",
      reunioesPorMes: "",
      especialidade: "",
      cidade: "",
      plano: "",
    });
    setShowDialog(true);
  };

  const openEdit = (cliente: Cliente) => {
    setEditing(cliente);
    setError("");
    setForm({
      nome: cliente.nome,
      responsavelId: cliente.responsavelId || NO_RESPONSAVEL,
      telefoneWhatsapp: cliente.telefoneWhatsapp || "",
      roteirosPorSemana: cliente.roteirosPorSemana?.toString() || "",
      reunioesPorMes: cliente.reunioesPorMes?.toString() || "",
      especialidade: cliente.especialidade || "",
      cidade: cliente.cidade || "",
      plano: cliente.plano || "",
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return;

    const payload = {
      nome: form.nome.trim(),
      responsavelId: form.responsavelId === NO_RESPONSAVEL ? null : form.responsavelId,
      telefoneWhatsapp: form.telefoneWhatsapp.trim() || null,
      roteirosPorSemana: form.roteirosPorSemana ? Number(form.roteirosPorSemana) : null,
      reunioesPorMes: form.reunioesPorMes ? Number(form.reunioesPorMes) : null,
      especialidade: form.especialidade.trim() || null,
      cidade: form.cidade.trim() || null,
      plano: form.plano.trim() || null,
    };

    const result = editing
      ? await updateCliente(editing.id, payload)
      : await addCliente(payload);

    if (!result.success) {
      setError(result.error || "Erro ao salvar cliente.");
      return;
    }
    setShowDialog(false);
  };

  const handleToggleAtivo = async (cliente: Cliente) => {
    await updateCliente(cliente.id, { ativo: !cliente.ativo });
  };

  const handleDelete = async (cliente: Cliente) => {
    if (!window.confirm(`Excluir o cliente "${cliente.nome}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    await removeCliente(cliente.id);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cadastro dos médicos atendidos, responsável da equipe e metas de cadência
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Clientes cadastrados</CardTitle>
          </div>
          <CardDescription>
            {clientesFiltrados.length} de {clientes.length} cliente{clientes.length !== 1 ? "s" : ""}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome..."
                className="h-9 pl-8"
              />
            </div>
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_RESPONSAVEIS}>Todo responsável</SelectItem>
                <SelectItem value={NO_RESPONSAVEL}>Sem responsável</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS_STATUS}>Todo status</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Badge
              variant={ocultarDemo ? "outline" : "default"}
              className="cursor-pointer h-9 px-3"
              onClick={() => setOcultarDemo(!ocultarDemo)}
            >
              {ocultarDemo ? "Demonstração oculta" : "Mostrando demonstração"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Metas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientesFiltrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {c.nome}
                        {c.isTest && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            demo
                          </Badge>
                        )}
                      </div>
                      {(c.especialidade || c.cidade || c.plano) && (
                        <p className="text-xs text-muted-foreground mt-0.5 font-normal">
                          {[c.especialidade, c.cidade, c.plano].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.responsavelName || (
                        <span className="text-destructive/80">sem responsável</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.telefoneWhatsapp || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.roteirosPorSemana ? `${c.roteirosPorSemana} roteiros/sem` : ""}
                      {c.roteirosPorSemana && c.reunioesPorMes ? " · " : ""}
                      {c.reunioesPorMes ? `${c.reunioesPorMes} reuniões/mês` : ""}
                      {!c.roteirosPorSemana && !c.reunioesPorMes && (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.ativo ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleToggleAtivo(c)}
                      >
                        {c.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {clientesFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {loading
                        ? "Carregando..."
                        : clientes.length === 0
                          ? "Nenhum cliente cadastrado ainda. Clientes são criados automaticamente quando um roteiro ou reunião é enviado com o nome dele."
                          : "Nenhum cliente encontrado com esses filtros."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do médico/cliente</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Dra. Juliana Paola"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Responsável da equipe</Label>
              <Select
                value={form.responsavelId}
                onValueChange={(v) => setForm({ ...form, responsavelId: v })}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_RESPONSAVEL}>Sem responsável</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">WhatsApp (com DDI, ex: 5511999999999)</Label>
              <Input
                value={form.telefoneWhatsapp}
                onChange={(e) => setForm({ ...form, telefoneWhatsapp: e.target.value })}
                placeholder="5511999999999"
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Roteiros / semana</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.roteirosPorSemana}
                  onChange={(e) => setForm({ ...form, roteirosPorSemana: e.target.value })}
                  placeholder="Ex: 3"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reuniões / mês</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.reunioesPorMes}
                  onChange={(e) => setForm({ ...form, reunioesPorMes: e.target.value })}
                  placeholder="Ex: 1"
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Especialidade</Label>
                <Input
                  value={form.especialidade}
                  onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
                  placeholder="Ex: Ginecologia"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input
                  value={form.cidade}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                  placeholder="Ex: São Paulo"
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Plano / ticket</Label>
              <Input
                value={form.plano}
                onChange={(e) => setForm({ ...form, plano: e.target.value })}
                placeholder="Ex: Premium, R$ 5.000/mês"
                className="h-9"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.nome.trim()}>
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
