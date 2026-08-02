import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { runMigrations } from "@/lib/db-migrations";

// Esta rota provisiona o banco e o usuário admin inicial. Antes, qualquer
// pessoa na internet podia chamá-la sem autenticação, e a senha do admin
// era o literal "admin123" embutido no código — ou seja, qualquer visitante
// desconhecido conseguia (re)criar um acesso master com credencial conhecida.
// Agora exige um segredo de setup (DB_INIT_SECRET) e uma senha definida via
// variável de ambiente (ADMIN_DEFAULT_PASSWORD), sem fallback fraco.
//
// Migrações de schema depois do setup inicial (colunas/tabelas novas) não
// precisam mais passar por aqui — ver POST /api/admin/migrate, que roda a
// mesma lista (src/lib/db-migrations.ts) protegida por sessão de master em
// vez do segredo de setup.
export async function POST(req: NextRequest) {
  try {
    const initSecret = process.env.DB_INIT_SECRET;
    if (!initSecret) {
      return NextResponse.json(
        { success: false, error: "DB_INIT_SECRET não configurado no servidor." },
        { status: 500 }
      );
    }

    const providedSecret = req.headers.get("x-init-secret");
    if (!providedSecret || providedSecret !== initSecret) {
      return NextResponse.json(
        { success: false, error: "Não autorizado." },
        { status: 401 }
      );
    }

    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;
    if (!adminPassword || adminPassword.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ADMIN_DEFAULT_PASSWORD não configurado (ou menor que 8 caracteres) no servidor.",
        },
        { status: 500 }
      );
    }

    await runMigrations();

    const existing = await pool.query(
      "SELECT id FROM dash_users WHERE email = $1",
      ["admin@dashboard.com"]
    );

    if (existing.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        `INSERT INTO dash_users (email, name, password, role)
         VALUES ($1, $2, $3, $4)`,
        ["admin@dashboard.com", "Admin Master", hashedPassword, "master"]
      );
    }

    return NextResponse.json({ success: true, message: "Banco inicializado com sucesso." });
  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao inicializar banco de dados." },
      { status: 500 }
    );
  }
}
