import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Segunda camada de checagem pras rotas mais sensíveis (gestão de usuários e
// administração do banco). O middleware (src/proxy.ts) roda em Edge e só
// consegue validar a assinatura do cookie — não dá pra consultar o Postgres
// ali (o driver `pg` exige runtime Node) — então um usuário excluído ou
// rebaixado de master continuava com acesso válido até o cookie expirar.
// Essas rotas já rodam em Node (usam `pool` diretamente), então revalidam
// aqui: usuário ainda existe, ainda é master, e a sessão não foi invalidada
// por uma troca de senha/papel depois que o cookie foi emitido.
export async function requireFreshMasterSession(
  req: NextRequest
): Promise<NextResponse | null> {
  const userId = req.headers.get("x-session-user-id");
  const sessionVersionHeader = req.headers.get("x-session-version");

  if (!userId || sessionVersionHeader === null) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const result = await pool.query(
    "SELECT role, session_version FROM dash_users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Usuário não existe mais." }, { status: 401 });
  }

  const row = result.rows[0];
  if (row.role !== "master" || String(row.session_version) !== sessionVersionHeader) {
    return NextResponse.json(
      { error: "Sessão expirada — faça login novamente." },
      { status: 401 }
    );
  }

  return null;
}
