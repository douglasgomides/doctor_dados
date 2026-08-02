import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/db-migrations";

// Roda as migrações de schema (tabelas/colunas novas) sem precisar do
// DB_INIT_SECRET — protegido por sessão de master (ver /api/admin no
// middleware, src/proxy.ts). Existe pra evitar depender de curl/segredo
// toda vez que o código adiciona uma coluna nova; um botão em
// Configurações chama isso.

export async function POST() {
  try {
    await runMigrations();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao rodar migrações:", error);
    return NextResponse.json({ error: "Erro ao rodar migrações." }, { status: 500 });
  }
}
