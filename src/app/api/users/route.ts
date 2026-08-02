import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Autenticação e restrição a papel "master" são impostas pelo middleware
// (src/proxy.ts) para todo o prefixo /api/users.

const VALID_ROLES = new Set(["master", "team"]);

// GET - Lista todos os usuários
export async function GET() {
  try {
    const result = await pool.query(
      "SELECT id, email, name, role, telefone_whatsapp FROM dash_users ORDER BY created_at"
    );

    const users = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      telefoneWhatsapp: row.telefone_whatsapp,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json(
      { error: "Erro ao listar usuários." },
      { status: 500 }
    );
  }
}

// POST - Cria novo usuário
export async function POST(req: NextRequest) {
  try {
    const { email, name, password, role, telefoneWhatsapp } = await req.json();

    if (!email || !name) {
      return NextResponse.json(
        { error: "E-mail e nome são obrigatórios." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Senha é obrigatória e deve ter ao menos 8 caracteres." },
        { status: 400 }
      );
    }

    if (role !== undefined && !VALID_ROLES.has(role)) {
      return NextResponse.json({ error: "Papel (role) inválido." }, { status: 400 });
    }

    // Verifica se email já existe
    const existing = await pool.query(
      "SELECT id FROM dash_users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "E-mail já cadastrado." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO dash_users (email, name, password, role, telefone_whatsapp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, telefone_whatsapp`,
      [email, name, hashedPassword, role || "team", telefoneWhatsapp || null]
    );

    const row = result.rows[0];
    return NextResponse.json({
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        telefoneWhatsapp: row.telefone_whatsapp,
      },
    });
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return NextResponse.json(
      { error: "Erro ao criar usuário." },
      { status: 500 }
    );
  }
}
