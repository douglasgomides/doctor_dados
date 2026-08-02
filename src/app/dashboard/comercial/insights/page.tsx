"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth-store";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingDown, TrendingUp, Loader2 } from "lucide-react";

interface Insight {
  rule: string;
  ocorrencias: number;
  percentualDasCalls: number;
  taxaFechoComProblema: number | null;
  exemplos: string[];
}

interface InsightsResponse {
  totalCalls: number;
  callsComResultado: number;
  taxaFechoGeral: number | null;
  insights: Insight[];
}

export default function ComercialInsightsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/comercial/insights")
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  if (currentUser?.role !== "master") {
    redirect("/dashboard/visao-geral");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Link
          href="/dashboard/comercial"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Comercial
        </Link>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Relatório de padrões</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Problemas mais recorrentes nas calls comerciais, cruzados com taxa de fechamento real
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Calls analisadas</p>
              <p className="text-2xl font-bold font-heading mt-1">{data.totalCalls}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Com resultado registrado</p>
              <p className="text-2xl font-bold font-heading mt-1">{data.callsComResultado}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Taxa de fechamento geral</p>
              <p className="text-2xl font-bold font-heading mt-1">
                {data.taxaFechoGeral != null ? `${data.taxaFechoGeral}%` : "—"}
              </p>
            </div>
          </div>

          {data.callsComResultado < 3 && (
            <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
              Poucas calls com resultado registrado ainda — a comparação de taxa de fechamento por
              problema fica mais confiável conforme a equipe for marcando &quot;fechou / não fechou /
              em negociação&quot; em cada call, na tela Comercial.
            </p>
          )}

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Problemas mais recorrentes</CardTitle>
              <CardDescription>Ordenado por frequência entre todas as calls analisadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.insights.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum problema identificado ainda nas calls analisadas.
                </p>
              )}
              {data.insights.map((insight) => {
                const delta =
                  insight.taxaFechoComProblema != null && data.taxaFechoGeral != null
                    ? insight.taxaFechoComProblema - data.taxaFechoGeral
                    : null;
                return (
                  <div key={insight.rule} className="rounded-lg border border-border p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {insight.rule}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          apareceu em {insight.ocorrencias} call{insight.ocorrencias !== 1 ? "s" : ""} (
                          {insight.percentualDasCalls}%)
                        </span>
                      </div>
                      {delta != null && (
                        <div
                          className={
                            "flex items-center gap-1 text-xs font-medium " +
                            (delta < 0 ? "text-destructive" : "text-emerald-600")
                          }
                        >
                          {delta < 0 ? (
                            <TrendingDown className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingUp className="h-3.5 w-3.5" />
                          )}
                          Calls com esse problema fecham {Math.abs(delta)}pp{" "}
                          {delta < 0 ? "menos" : "mais"} que a média
                        </div>
                      )}
                    </div>
                    {insight.exemplos.length > 0 && (
                      <ul className="space-y-1">
                        {insight.exemplos.map((ex, i) => (
                          <li key={i} className="text-sm text-muted-foreground">
                            • {ex}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
