import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Recuperação de emergência: cria (se o e-mail não existir) ou reseta a
// senha (se existir) de um usuário master. Pensado pra quando ninguém mais
// consegue logar e também não se tem acesso ao painel da Vercel pra
// conferir o DB_INIT_SECRET — por isso aceita DOIS segredos possíveis:
//
// 1. DB_INIT_SECRET (variável de ambiente, o "correto" a longo prazo).
// 2. EMERGENCY_RECOVERY_CODE abaixo — fixo no código, gerado uma única vez
//    pra destravar o acesso sem depender de nada externo. É um mecanismo de
//    "quebra o vidro": funciona, mas fica visível a quem tiver acesso a
//    este repositório. Assim que o acesso normal for recuperado, troque
//    esse valor (ou apague este bloco) e prefira o fluxo por
//    DB_INIT_SECRET / tela de Usuários daqui pra frente.
const EMERGENCY_RECOVERY_CODE = "YECniw3xEGbN6kmUhN6ySusS";

export async function POST(req: NextRequest) {
  try {
    const providedSecret = req.headers.get("x-init-secret");
    const validSecret =
      !!providedSecret &&
      (providedSecret === process.env.DB_INIT_SECRET || providedSecret === EMERGENCY_RECOVERY_CODE);

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
        `UPDATE dash_users SET password = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email, name, role`,
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
