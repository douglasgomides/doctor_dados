"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
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
import { Users, Plus, Pencil, Trash2, Shield, UserIcon } from "lucide-react";
import { User, UserRole } from "@/types";

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const { users, fetchUsers, addUser, updateUser, removeUser } = useUsersStore();

  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "team" as UserRole,
  });

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (currentUser?.role !== "master") {
    redirect("/dashboard/visao-geral");
  }

  const openAdd = () => {
    setEditingUser(null);
    setForm({ name: "", email: "", password: "", role: "team" });
    setShowDialog(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: "", role: user.role });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) return;
    if (!editingUser && form.password.length < 8) return;

    if (editingUser) {
      const data: Record<string, string> = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.password) data.password = form.password;
      await updateUser(editingUser.id, data);
    } else {
      await addUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
      });
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) return;
    await removeUser(id);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerenciar Usuários</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Adicione, edite ou remova usuários e defina suas permissões
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Usuários Cadastrados</CardTitle>
          </div>
          <CardDescription>
            {users.length} usuário{users.length !== 1 ? "s" : ""} no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead className="w-[100px] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {user.role === "master" ? (
                          <Shield className="h-4 w-4 text-primary" />
                        ) : (
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        {user.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "master" ? "default" : "secondary"}>
                        {user.role === "master" ? "Master" : "Equipe"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(user)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {user.id !== currentUser?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(user.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Editar Usuário" : "Novo Usuário"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome completo"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Senha {editingUser ? "(deixe vazio para manter a atual)" : "(mínimo 8 caracteres)"}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingUser ? "••••••••" : "Senha do usuário"}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nível de Acesso</Label>
              <Select
                value={form.role}
                onValueChange={(v: UserRole) => setForm({ ...form, role: v })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Master (acesso total)</SelectItem>
                  <SelectItem value="team">Equipe (valida roteiros/reuniões)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !form.name || !form.email || (!editingUser && form.password.length < 8)
              }
            >
              {editingUser ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
