"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Sparkles, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState<"gerar" | "remover" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "sucesso" | "erro"; texto: string } | null>(null);

  async function gerarExemplos() {
    setLoading("gerar");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/seed-exemplos", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar dados de exemplo.");
      setFeedback({
        type: "sucesso",
        texto:
          "Exemplos criados em Roteiros, Reuniões, Comercial e Performance (cliente \"Dr. Exemplo (demonstração)\"). Dá uma olhada nessas telas.",
      });
    } catch (error) {
      setFeedback({ type: "erro", texto: error instanceof Error ? error.message : "Erro inesperado." });
    } finally {
      setLoading(null);
    }
  }

  async function removerExemplos() {
    setLoading("remover");
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/seed-exemplos", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao remover dados de exemplo.");
      setFeedback({ type: "sucesso", texto: "Dados de exemplo removidos de todas as telas." });
    } catch (error) {
      setFeedback({ type: "erro", texto: error instanceof Error ? error.message : "Erro inesperado." });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerencie sua conta</p>
      </div>

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
              {user?.role === "master" ? "Master" : "Equipe"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {user?.role === "master" && (
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Dados de exemplo</CardTitle>
            </div>
            <CardDescription>
              Gera exemplos reais (avaliados pela IA de verdade) em Roteiros, Reuniões, Comercial e
              Performance, pra mostrar pra equipe como a ferramenta entrega antes de ter volume de
              produção. Tudo fica marcado com o cliente &quot;Dr. Exemplo (demonstração)&quot; e é
              removível com um clique.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={gerarExemplos} disabled={loading !== null} className="h-9">
                {loading === "gerar" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Gerar dados de exemplo
              </Button>
              <Button
                onClick={removerExemplos}
                disabled={loading !== null}
                variant="outline"
                className="h-9"
              >
                {loading === "remover" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Remover dados de exemplo
              </Button>
            </div>
            {feedback && (
              <p
                className={`text-sm ${
                  feedback.type === "sucesso" ? "text-primary" : "text-destructive"
                }`}
              >
                {feedback.texto}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
