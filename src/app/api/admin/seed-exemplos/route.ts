import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  TAG,
  EXAMPLE_AUTHORS,
  EXAMPLE_CLIENT_NAMES,
  LEGACY_AUTHOR_EMAIL,
  LEGACY_CLIENT_NAME,
} from "@/lib/seed-exemplos-data";

// A geração em si (POST) vive em /api/admin/seed-exemplos/{init,roteiro,
// reuniao,comercial} — cada peça de conteúdo numa função serverless
// própria, pra nenhuma chamada de IA competir com outra pelo mesmo tempo
// limite de execução. Esta rota só cuida da limpeza (DELETE), que apaga
// tudo de uma vez: os autores fictícios (cascade apaga os roteiros/
// reuniões deles), as análises comerciais marcadas com o prefixo
// "[EXEMPLO]", e os clientes fictícios — incluindo os nomes de uma versão
// anterior desta função, caso ela já tenha rodado antes.

export async function DELETE() {
  try {
    await pool.query(`DELETE FROM comercial_analises WHERE titulo LIKE $1`, [`${TAG}%`]);
    await pool.query(`DELETE FROM dash_users WHERE email = ANY($1::text[])`, [
      [...EXAMPLE_AUTHORS.map((a) => a.email), LEGACY_AUTHOR_EMAIL],
    ]);
    await pool.query(`DELETE FROM clientes WHERE nome = ANY($1::text[])`, [
      [...EXAMPLE_CLIENT_NAMES, LEGACY_CLIENT_NAME],
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover dados de exemplo:", error);
    return NextResponse.json({ error: "Erro ao remover dados de exemplo." }, { status: 500 });
  }
}
