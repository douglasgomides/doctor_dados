import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { findOrCreateClienteId } from "@/lib/clientes";
import { EXAMPLE_AUTHORS, EXAMPLE_CLIENT_NAMES, getOrCreateExampleAuthor } from "@/lib/seed-exemplos-data";
import { requireFreshMasterSession } from "@/lib/session-guard";

// Passo 1 da geração de dados de exemplo: cria/garante os 3 autores e os 5
// clientes fictícios (sem nenhuma chamada de IA, então é rápido). A tela de
// Configurações chama essa rota primeiro, pega os ids, e só depois dispara
// as 5 rotas de conteúdo (roteiro/reuniao/comercial) em paralelo — cada uma
// delas é uma função serverless própria, então nenhuma fica esperando as
// outras nem soma tempo de execução.

export async function POST(req: NextRequest) {
  try {
    const denied = await requireFreshMasterSession(req);
    if (denied) return denied;

    const authors = await Promise.all([0, 1, 2].map((i) => getOrCreateExampleAuthor(i)));
    const clientIds = await Promise.all(
      EXAMPLE_CLIENT_NAMES.map((nome) => findOrCreateClienteId(nome))
    );

    await Promise.all(
      clientIds.map((clientId, i) =>
        pool.query(
          `UPDATE clientes SET responsavel_id = $1, roteiros_por_semana = 2, reunioes_por_mes = 1, ativo = true, is_test = true WHERE id = $2`,
          [authors[i % authors.length].id, clientId]
        )
      )
    );

    return NextResponse.json({
      success: true,
      authors: authors.map((a, i) => ({ ...a, email: EXAMPLE_AUTHORS[i].email })),
      clients: clientIds.map((id, i) => ({ id, nome: EXAMPLE_CLIENT_NAMES[i] })),
    });
  } catch (error) {
    console.error("Erro ao inicializar dados de exemplo:", error);
    return NextResponse.json({ error: "Erro ao inicializar dados de exemplo." }, { status: 500 });
  }
}
