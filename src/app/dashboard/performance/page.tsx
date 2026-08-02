"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { usePerformanceStore } from "@/store/performance-store";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, ClipboardCheck, Users2 } from "lucide-react";

function scoreBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

export default function PerformancePage() {
  const currentUser = useAuthStore((s) => s.user);
  const { overview, loading, error, fetchPerformance } = usePerformanceStore();

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  if (currentUser?.role !== "master") {
    redirect("/dashboard/visao-geral");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Performance da Equipe</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Nota média e taxa de aprovação por pessoa — pra pegar um problema de qualidade
          recorrente antes que ele vire um problema com o cliente.
        </p>
      </div>

      {loading && !overview && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-48">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {overview && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-border/50">
              <CardContent className="pt-6 flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Média geral — Roteiros
                  </p>
                  <p className="text-2xl font-bold font-heading">
                    {overview.mediaGeralRoteiros}/100
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="pt-6 flex items-center gap-3">
                <Users2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Média geral — Reuniões
                  </p>
                  <p className="text-2xl font-bold font-heading">
                    {overview.mediaGeralReunioes}/100
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Por pessoa</CardTitle>
              </div>
              <CardDescription>
                {overview.membros.length} pessoa{overview.membros.length !== 1 ? "s" : ""} com
                envios registrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/50 overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Pessoa</TableHead>
                      <TableHead>Roteiros</TableHead>
                      <TableHead>Nota média</TableHead>
                      <TableHead>Aprovação</TableHead>
                      <TableHead>Reuniões</TableHead>
                      <TableHead>Nota média</TableHead>
                      <TableHead>Aprovação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.membros.map((m) => (
                      <TableRow key={m.authorName}>
                        <TableCell className="font-medium">{m.authorName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.roteirosTotal}
                        </TableCell>
                        <TableCell>
                          {m.roteirosTotal > 0 ? (
                            <Badge variant={scoreBadgeVariant(m.roteirosScoreMedia)}>
                              {m.roteirosScoreMedia}/100
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.roteirosTotal > 0 ? `${m.roteirosTaxaAprovacao}%` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.reunioesTotal}
                        </TableCell>
                        <TableCell>
                          {m.reunioesTotal > 0 ? (
                            <Badge variant={scoreBadgeVariant(m.reunioesScoreMedia)}>
                              {m.reunioesScoreMedia}/100
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/50 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.reunioesTotal > 0 ? `${m.reunioesTaxaAprovacao}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {overview.membros.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhum roteiro ou reunião registrado ainda.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
