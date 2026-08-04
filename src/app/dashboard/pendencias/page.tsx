"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePendenciasStore } from "@/store/pendencias-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox, AlertTriangle, RefreshCw, ArrowUpRight } from "lucide-react";
import { Pendencia, PendenciaTipo, PENDENCIA_TIPO_LABELS } from "@/types";

// Central única de "o que precisa da minha atenção agora" — a mesma
// agregação que hoje só vira mensagem de WhatsApp 1x/dia às 9h (ver
// src/lib/pendencias.ts), mas aqui disponível sob demanda, com link direto
// pro registro em vez de precisar procurar manualmente no módulo certo.

const MODULO_POR_TIPO: Partial<Record<PendenciaTipo, { href: string; idKey: string }>> = {
  roteiro_ajustar: { href: "/dashboard/roteiros", idKey: "roteiroId" },
  reuniao_ajustar: { href: "/dashboard/reunioes", idKey: "reuniaoId" },
  comercial_ajustar: { href: "/dashboard/comercial", idKey: "comercialId" },
};

function linkDaPendencia(p: Pendencia): string | null {
  const modulo = MODULO_POR_TIPO[p.tipo];
  if (!modulo) return null;
  const id = p.detalhe[modulo.idKey];
  if (!id) return null;
  return `${modulo.href}?id=${id}`;
}

export default function PendenciasPage() {
  const { pendencias, loading, fetchPendencias } = usePendenciasStore();

  useEffect(() => {
    fetchPendencias();
  }, [fetchPendencias]);

  const ordenadas = [...pendencias].sort((a, b) => Number(b.urgente) - Number(a.urgente));
  const urgentes = pendencias.filter((p) => p.urgente).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Central de Pendências</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tudo que precisa de uma decisão agora — roteiros/reuniões/calls pendentes de ajuste e
            clientes abaixo da meta de cadência. É a mesma lista do aviso diário de WhatsApp, mas
            sob demanda.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchPendencias()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Pendências</CardTitle>
          </div>
          <CardDescription>
            {pendencias.length} pendência{pendencias.length !== 1 ? "s" : ""}
            {urgentes > 0 && (
              <span className="text-destructive font-medium"> · {urgentes} urgente{urgentes !== 1 ? "s" : ""}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendencias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma pendência agora. Tudo em dia.
            </p>
          ) : (
            <ul className="space-y-2">
              {ordenadas.map((p, i) => {
                const link = linkDaPendencia(p);
                const conteudo = (
                  <div
                    className={`rounded-lg border p-3.5 space-y-1.5 transition-colors ${
                      p.urgente
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-border/50 hover:bg-muted/30"
                    } ${link ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.urgente && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        <Badge variant="outline" className="text-[10px]">
                          {PENDENCIA_TIPO_LABELS[p.tipo]}
                        </Badge>
                        <span className="text-sm font-medium">{p.clienteNome}</span>
                      </div>
                      {link && <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{p.mensagem}</p>
                    {p.responsavelNome && (
                      <p className="text-xs text-muted-foreground">Responsável: {p.responsavelNome}</p>
                    )}
                  </div>
                );
                return (
                  <li key={i}>
                    {link ? (
                      <Link href={link}>{conteudo}</Link>
                    ) : (
                      conteudo
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
