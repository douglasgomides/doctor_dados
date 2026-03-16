import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const result = await pool.query(
      "SELECT * FROM dash_users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "E-mail não encontrado." },
        { status: 401 }
      );
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return NextResponse.json(
        { success: false, error: "Senha incorreta." },
        { status: 401 }
      );
    }

    // Retorna user sem a senha
    const { password: _, ...safeUser } = user;
    return NextResponse.json({
      success: true,
      user: {
        id: safeUser.id,
        email: safeUser.email,
        name: safeUser.name,
        role: safeUser.role,
        accountId: safeUser.account_id,
        accountName: safeUser.account_name,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor." },
      { status: 500 }
    );
  }
}
