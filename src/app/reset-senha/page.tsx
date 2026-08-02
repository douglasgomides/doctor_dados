"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

// Página de recuperação de emergência: se o e-mail já existir, troca a
// senha; se não existir, cria um usuário master novo. Fica fora do
// /dashboard (não exige sessão), mas a ação em si continua exigindo um
// segredo — DB_INIT_SECRET (Vercel) ou o código de recuperação fixo no
// código (ver comentário em /api/db/reset-admin-password).

export default function ResetSenhaPage() {
  const [email, setEmail] = useState("admin@dashboard.com");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "sucesso" | "erro"; texto: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/db/reset-admin-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-init-secret": secret },
        body: JSON.stringify({ email, name, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao processar.");
      setFeedback({
        type: "sucesso",
        texto:
          data.action === "criado"
            ? `Usuário master ${data.user.email} criado. Já pode fazer login com a senha definida.`
            : `Senha atualizada para ${data.user.email}. Já pode fazer login com a nova senha.`,
      });
    } catch (error) {
      setFeedback({ type: "erro", texto: error instanceof Error ? error.message : "Erro inesperado." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-[420px] w-[620px] rounded-full bg-primary/15 blur-[120px]" />

      <div className="w-full max-w-md space-y-6 relative">
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F0D97D] via-primary to-[#9C7A1E] shadow-[0_0_30px_-6px_rgba(208,164,101,0.6)]">
            <span className="text-black font-bold text-xl tracking-tight font-heading">DC</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
            Recuperar acesso
          </h1>
          <p className="text-sm text-primary/80 text-center">
            Recupera a senha de um usuário existente ou cadastra um novo master
          </p>
        </div>

        <Card className="border-primary/20 bg-card/90 backdrop-blur-sm shadow-[0_0_60px_-20px_rgba(208,164,101,0.35)]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-foreground font-heading">Recuperar ou cadastrar</CardTitle>
            <CardDescription className="text-muted-foreground">
              Se o e-mail já existir, a senha é trocada. Se não existir, cria um usuário master novo
              com essa senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/80">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground/80">
                  Nome (só usado se for criar um usuário novo)
                </Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-foreground/80">
                  Nova senha (mín. 8 caracteres)
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secret" className="text-foreground/80">
                  Código de recuperação
                </Label>
                <div className="relative">
                  <Input
                    id="secret"
                    type={showSecret ? "text" : "password"}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {feedback && (
                <div
                  className={`text-sm rounded-md px-3 py-2 border ${
                    feedback.type === "sucesso"
                      ? "text-primary bg-primary/10 border-primary/20"
                      : "text-destructive bg-destructive/10 border-destructive/20"
                  }`}
                >
                  {feedback.texto}
                </div>
              )}

              <Button type="submit" className="w-full font-semibold" disabled={loading}>
                {loading ? "Processando..." : "Recuperar / cadastrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground/70">
          Doctor Creator — acesso restrito à equipe interna
        </p>
      </div>
    </div>
  );
}
