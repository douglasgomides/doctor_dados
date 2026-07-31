import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Esta rota provisiona o banco e o usuário admin inicial. Antes, qualquer
// pessoa na internet podia chamá-la sem autenticação, e a senha do admin
// era o literal "admin123" embutido no código — ou seja, qualquer visitante
// desconhecido conseguia (re)criar um acesso master com credencial conhecida.
// Agora exige um segredo de setup (DB_INIT_SECRET) e uma senha definida via
// variável de ambiente (ADMIN_DEFAULT_PASSWORD), sem fallback fraco.
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

    // Cria tabela dash_users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dash_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'client',
        account_id VARCHAR(100) NOT NULL DEFAULT '',
        account_name VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Verifica se já existe admin
    const existing = await pool.query(
      "SELECT id FROM dash_users WHERE email = $1",
      ["admin@dashboard.com"]
    );

    if (existing.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        `INSERT INTO dash_users (email, name, password, role, account_id, account_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          "admin@dashboard.com",
          "Admin Master",
          hashedPassword,
          "master",
          "all",
          "Todas as Contas",
        ]
      );
    }

    // Cria tabela roteiros (validador de qualidade de Reels/carrossel/Stories)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roteiros (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES dash_users(id) ON DELETE CASCADE,
        author_name VARCHAR(255) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        format VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        status VARCHAR(20) NOT NULL,
        score INTEGER NOT NULL,
        issues JSONB NOT NULL DEFAULT '[]',
        review_note TEXT,
        reviewed_by_name VARCHAR(255),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    return NextResponse.json({ success: true, message: "Banco inicializado com sucesso." });
  } catch (error) {
    console.error("Erro ao inicializar banco:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao inicializar banco de dados." },
      { status: 500 }
    );
  }
}
