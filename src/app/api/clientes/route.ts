import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { Cliente } from "@/types";

// Autenticação e restrição a papel "master" são impostas pelo middleware
// (src/proxy.ts) para todo o prefixo /api/clientes.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): Cliente {
  return {
    id: row.id,
    nome: row.nome,
    responsavelId: row.responsavel_id,
    responsavelName: row.responsavel_name,
    telefoneWhatsapp: row.telefone_whatsapp,
    roteirosPorSemana: row.roteiros_por_semana,
    reunioesPorMes: row.reunioes_por_mes,
    especialidade: row.especialidade,
    cidade: row.cidade,
    plano: row.plano,
    ativo: row.ativo,
    isTest: row.is_test,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function GET() {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name AS responsavel_name
       FROM clientes c
       LEFT JOIN dash_users u ON u.id = c.responsavel_id
       ORDER BY c.nome`
    );
    return NextResponse.json({ clientes: result.rows.map(mapRow) });
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    return NextResponse.json({ error: "Erro ao listar clientes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const {
      nome,
      responsavelId,
      telefoneWhatsapp,
      roteirosPorSemana,
      reunioesPorMes,
      especialidade,
      cidade,
      plano,
    } = await req.json();

    if (!nome || typeof nome !== "string" || !nome.trim()) {
      return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO clientes (nome, responsavel_id, telefone_whatsapp, roteiros_por_semana, reunioes_por_mes, especialidade, cidade, plano)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        nome.trim(),
        responsavelId || null,
        telefoneWhatsapp || null,
        roteirosPorSemana || null,
        reunioesPorMes || null,
        especialidade || null,
        cidade || null,
        plano || null,
      ]
    );

    const withResponsavel = await pool.query(
      `SELECT c.*, u.name AS responsavel_name
       FROM clientes c
       LEFT JOIN dash_users u ON u.id = c.responsavel_id
       WHERE c.id = $1`,
      [result.rows[0].id]
    );

    return NextResponse.json({ cliente: mapRow(withResponsavel.rows[0]) });
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === "23505") {
      return NextResponse.json({ error: "Já existe um cliente com esse nome." }, { status: 400 });
    }
    console.error("Erro ao criar cliente:", error);
    return NextResponse.json({ error: "Erro ao criar cliente." }, { status: 500 });
  }
}
