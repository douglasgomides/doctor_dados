import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Autenticação e restrição a papel "master" são impostas pelo middleware
// (src/proxy.ts) para todo o prefixo /api/users.

const VALID_ROLES = new Set(["master", "team"]);

// PUT - Atualiza usuário
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await req.json();

    if (data.role !== undefined && !VALID_ROLES.has(data.role)) {
      return NextResponse.json({ error: "Papel (role) inválido." }, { status: 400 });
    }

    if (data.password !== undefined && data.password !== "" && data.password.length < 8) {
      return NextResponse.json(
        { error: "Senha deve ter ao menos 8 caracteres." },
        { status: 400 }
      );
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.password) {
      fields.push(`password = $${paramIndex++}`);
      values.push(await bcrypt.hash(data.password, 10));
    }
    if (data.role !== undefined) {
      fields.push(`role = $${paramIndex++}`);
      values.push(data.role);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE dash_users SET ${fields.join(", ")} WHERE id = $${paramIndex}
       RETURNING id, email, name, role`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar usuário." },
      { status: 500 }
    );
  }
}

// DELETE - Remove usuário
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      "DELETE FROM dash_users WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover usuário:", error);
    return NextResponse.json(
      { error: "Erro ao remover usuário." },
      { status: 500 }
    );
  }
}
