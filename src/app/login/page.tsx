"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      const role = useAuthStore.getState().user?.role;
      router.push(role === "team" ? "/dashboard/roteiros" : "/dashboard/visao-geral");
    } else {
      setError(result.error || "Erro ao fazer login.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Glow dourado de fundo */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-[420px] w-[620px] rounded-full bg-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(208,164,101,0.08),transparent_55%)]" />

      <div className="w-full max-w-md space-y-8 relative">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F0D97D] via-primary to-[#9C7A1E] shadow-[0_0_30px_-6px_rgba(208,164,101,0.6)]">
            <span className="text-black font-bold text-xl tracking-tight font-heading">DC</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">
            Doctor Creator Ops
          </h1>
          <p className="text-sm text-primary/80">
            Roteiros, reuniões e visão geral dos clientes em um só lugar
          </p>
        </div>

        {/* Card de Login */}
        <Card className="border-primary/20 bg-card/90 backdrop-blur-sm shadow-[0_0_60px_-20px_rgba(208,164,101,0.35)]">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-foreground font-heading">Entrar na plataforma</CardTitle>
            <CardDescription className="text-muted-foreground">
              Insira suas credenciais para acessar o painel
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
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/80">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/40 border-t-black" />
                    Entrando...
                  </span>
                ) : (
                  "Entrar"
                )}
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
