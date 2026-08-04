import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { registrarAuditoria } from "@/lib/audit-log";
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = req.headers.get("x-session-user-id");
    const sessionName = req.headers.get("x-session-name");
    const { id } = await params;
    const data = await req.json();

    const antes = await pool.query("SELECT * FROM clientes WHERE id = $1", [id]);
    if (antes.rows.length === 0) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.nome !== undefined) {
      if (!data.nome.trim()) {
        return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
      }
      fields.push(`nome = $${paramIndex++}`);
      values.push(data.nome.trim());
    }
    if (data.responsavelId !== undefined) {
      fields.push(`responsavel_id = $${paramIndex++}`);
      values.push(data.responsavelId || null);
    }
    if (data.telefoneWhatsapp !== undefined) {
      fields.push(`telefone_whatsapp = $${paramIndex++}`);
      values.push(data.telefoneWhatsapp || null);
    }
    if (data.roteirosPorSemana !== undefined) {
      fields.push(`roteiros_por_semana = $${paramIndex++}`);
      values.push(data.roteirosPorSemana || null);
    }
    if (data.reunioesPorMes !== undefined) {
      fields.push(`reunioes_por_mes = $${paramIndex++}`);
      values.push(data.reunioesPorMes || null);
    }
    if (data.ativo !== undefined) {
      fields.push(`ativo = $${paramIndex++}`);
      values.push(!!data.ativo);
    }
    if (data.especialidade !== undefined) {
      fields.push(`especialidade = $${paramIndex++}`);
      values.push(data.especialidade || null);
    }
    if (data.cidade !== undefined) {
      fields.push(`cidade = $${paramIndex++}`);
      values.push(data.cidade || null);
    }
    if (data.plano !== undefined) {
      fields.push(`plano = $${paramIndex++}`);
      values.push(data.plano || null);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE clientes SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const withResponsavel = await pool.query(
      `SELECT c.*, u.name AS responsavel_name
       FROM clientes c
       LEFT JOIN dash_users u ON u.id = c.responsavel_id
       WHERE c.id = $1`,
      [id]
    );

    await registrarAuditoria({
      entityType: "cliente",
      entityId: id,
      action: "edit",
      actorId: userId,
      actorName: sessionName,
      before: antes.rows[0],
      after: withResponsavel.rows[0],
    });

    return NextResponse.json({ cliente: mapRow(withResponsavel.rows[0]) });
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === "23505") {
      return NextResponse.json({ error: "Já existe um cliente com esse nome." }, { status: 400 });
    }
    console.error("Erro ao atualizar cliente:", error);
    return NextResponse.json({ error: "Erro ao atualizar cliente." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = req.headers.get("x-session-user-id");
    const sessionName = req.headers.get("x-session-name");
    const { id } = await params;

    const result = await pool.query("DELETE FROM clientes WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    await registrarAuditoria({
      entityType: "cliente",
      entityId: id,
      action: "delete",
      actorId: userId,
      actorName: sessionName,
      before: result.rows[0],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover cliente:", error);
    return NextResponse.json({ error: "Erro ao remover cliente." }, { status: 500 });
  }
}
