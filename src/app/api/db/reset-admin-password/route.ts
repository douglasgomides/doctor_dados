import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Reset de emergência pra senha de um usuário master (tipicamente
// admin@dashboard.com), pra quando a senha original foi perdida e ninguém
// mais consegue logar como master pra trocar pela tela de Usuários. Segue o
// mesmo padrão de segurança de /api/db/init: fora do prefixo autenticado por
// sessão (é chamado de fora do navegador logado), protegido pelo mesmo
// segredo de setup (DB_INIT_SECRET, header "x-init-secret") que só quem
// configurou o projeto na Vercel possui.

export async function POST(req: NextRequest) {
  try {
    const initSecret = process.env.DB_INIT_SECRET;
    if (!initSecret) {
      return NextResponse.json(
        { error: "DB_INIT_SECRET não configurado no servidor." },
        { status: 500 }
      );
    }

    const providedSecret = req.headers.get("x-init-secret");
    if (!providedSecret || providedSecret !== initSecret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { email, newPassword } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Informe o e-mail do usuário." }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "A nova senha precisa ter pelo menos 8 caracteres." },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE dash_users SET password = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, name, role`,
      [hashed, email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Nenhum usuário encontrado com esse e-mail." }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error("Erro ao resetar senha:", error);
    return NextResponse.json({ error: "Erro ao resetar senha." }, { status: 500 });
  }
}
