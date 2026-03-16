"use client";

import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, User, Link2 } from "lucide-react";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie sua conta e integrações
        </p>
      </div>

      {/* Perfil */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Perfil</CardTitle>
          </div>
          <CardDescription>Informações da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={user?.name || ""} disabled className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input value={user?.email || ""} disabled className="h-9" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs">Nível de Acesso:</Label>
            <Badge variant={user?.role === "master" ? "default" : "secondary"}>
              {user?.role === "master" ? "Conta Master" : "Conta Cliente"}
            </Badge>
          </div>
          {user?.role === "client" && (
            <div className="flex items-center gap-3">
              <Label className="text-xs">Conta de Anúncio:</Label>
              <span className="text-sm font-medium">{user.accountName}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Sheets Integration */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Integração Google Sheets</CardTitle>
          </div>
          <CardDescription>
            Conecte sua planilha para leitura e escrita de dados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">URL da Planilha</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ID da Aba (Sheet)</Label>
            <Input placeholder="Sheet1" className="h-9" />
          </div>
          <Button disabled>
            <Settings className="h-4 w-4 mr-2" />
            Conectar (em breve)
          </Button>
          <p className="text-xs text-muted-foreground">
            A integração com Google Sheets será ativada na próxima fase do
            projeto.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button variant="outline" disabled>
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
