import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Listagem de negócios pesquisável/filtrável, pra a aba "Negócios" do
// dashboard de Inteligência Comercial — o detalhamento linha a linha que
// os agregados de /api/dashboard/clint não mostram (nome do contato,
// produto, origem, valor, etapa). Protegida pelo prefixo /api/dashboard
// em src/proxy.ts (sessão master).

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 300;

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const search = params.get("search")?.trim() || null;
    const status = params.get("status")?.trim() || null;
    const origin = params.get("origin")?.trim() || null;
    const product = params.get("product")?.trim() || null;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT));
    const offset = Math.max(0, Number(params.get("offset")) || 0);

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (search) {
      conditions.push(
        `(d.contact_name ILIKE $${i} OR COALESCE(d.fields->>'product_name', d.fields->>'produto') ILIKE $${i})`
      );
      values.push(`%${search}%`);
      i++;
    }
    if (status) {
      conditions.push(`d.status = $${i++}`);
      values.push(status);
    }
    if (origin) {
      conditions.push(`o.name = $${i++}`);
      values.push(origin);
    }
    if (product) {
      conditions.push(`COALESCE(d.fields->>'product_name', d.fields->>'produto') = $${i++}`);
      values.push(product);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rowsResult = await pool.query(
      `
      SELECT
        d.id,
        d.contact_name,
        d.contact_id,
        d.status,
        d.stage,
        d.value,
        d.currency,
        d.clint_created_at,
        d.won_at,
        COALESCE(o.name, 'Sem origem') AS origin_name,
        COALESCE(d.fields->>'product_name', d.fields->>'produto') AS product,
        COALESCE(d.fields->>'fonte') AS fonte,
        d.user_name
      FROM clint_deals d
      LEFT JOIN clint_origins o ON o.id = d.origin_id
      ${whereClause}
      ORDER BY d.clint_created_at DESC NULLS LAST
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...values, limit, offset]
    );

    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM clint_deals d
      LEFT JOIN clint_origins o ON o.id = d.origin_id
      ${whereClause}
      `,
      values
    );

    const rows = rowsResult.rows.map((r) => ({
      id: r.id,
      contactId: r.contact_id,
      contactName: r.contact_name || "(sem nome)",
      status: r.status,
      stage: r.stage,
      value: Number(r.value),
      currency: r.currency,
      createdAt: r.clint_created_at,
      wonAt: r.won_at,
      originName: r.origin_name,
      product: r.product,
      fonte: r.fonte,
      userName: r.user_name,
    }));

    return NextResponse.json({
      deals: rows,
      total: Number(countResult.rows[0].total),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Erro ao listar negócios da Clint:", error);
    return NextResponse.json({ error: "Erro ao listar negócios." }, { status: 500 });
  }
}
