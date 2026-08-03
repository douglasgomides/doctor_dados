import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Recuperação de emergência: cria (se o e-mail não existir) ou reseta a
// senha (se existir) de um usuário master. Protegido só por DB_INIT_SECRET
// (variável de ambiente na Vercel) — a versão anterior também aceitava um
// código fixo embutido no código como atalho pra destravar o acesso inicial;
// esse atalho foi removido porque um segredo commitado no Git nunca deixa
// de ser recuperável (fica no histórico mesmo depois de apagado do arquivo
// atual), e o acesso master normal já está funcionando.
export async function POST(req: NextRequest) {
  try {
    const providedSecret = req.headers.get("x-init-secret");
    const initSecret = process.env.DB_INIT_SECRET;
    const validSecret = !!providedSecret && !!initSecret && providedSecret === initSecret;

    if (!validSecret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { email, name, newPassword } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "A nova senha precisa ter pelo menos 8 caracteres." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashed = await bcrypt.hash(newPassword, 10);

    const existing = await pool.query("SELECT id FROM dash_users WHERE email = $1", [
      normalizedEmail,
    ]);

    if (existing.rows.length > 0) {
      const result = await pool.query(
        `UPDATE dash_users SET password = $1, updated_at = NOW(), session_version = session_version + 1
         WHERE email = $2 RETURNING id, email, name, role`,
        [hashed, normalizedEmail]
      );
      return NextResponse.json({ success: true, action: "atualizado", user: result.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO dash_users (email, name, password, role)
       VALUES ($1, $2, $3, 'master')
       RETURNING id, email, name, role`,
      [normalizedEmail, (typeof name === "string" && name.trim()) || normalizedEmail.split("@")[0], hashed]
    );
    return NextResponse.json({ success: true, action: "criado", user: result.rows[0] });
  } catch (error) {
    console.error("Erro ao recuperar acesso:", error);
    return NextResponse.json({ error: "Erro ao recuperar acesso." }, { status: 500 });
  }
}
