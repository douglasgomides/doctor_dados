import pool from "@/lib/db";

// Todas as migrações de schema do app (tabelas + colunas novas), separadas
// da criação do admin inicial (que só faz sentido em /api/db/init, o único
// lugar que roda sem ninguém logado ainda). Idempotente — todo CREATE/ALTER
// usa IF NOT EXISTS, então rodar de novo não faz mal. Chamada por:
// - POST /api/db/init (setup inicial, protegido por DB_INIT_SECRET)
// - POST /api/admin/migrate (atualizações depois do setup, master logado)
export async function runMigrations(): Promise<void> {
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reunioes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID NOT NULL REFERENCES dash_users(id) ON DELETE CASCADE,
      author_name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      score INTEGER NOT NULL,
      issues JSONB NOT NULL DEFAULT '[]',
      suggested_agenda JSONB NOT NULL DEFAULT '[]',
      review_note TEXT,
      reviewed_by_name VARCHAR(255),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(255) UNIQUE NOT NULL,
      responsavel_id UUID REFERENCES dash_users(id) ON DELETE SET NULL,
      telefone_whatsapp VARCHAR(30),
      roteiros_por_semana INTEGER,
      reunioes_por_mes INTEGER,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE roteiros
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE reunioes
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE dash_users
    ADD COLUMN IF NOT EXISTS telefone_whatsapp VARCHAR(30);
  `);

  await pool.query(`
    ALTER TABLE reunioes
    ADD COLUMN IF NOT EXISTS suggested_content_ideas JSONB NOT NULL DEFAULT '[]';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comercial_analises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(500) NOT NULL DEFAULT '',
      participantes JSONB NOT NULL DEFAULT '[]',
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      score INTEGER NOT NULL,
      issues JSONB NOT NULL DEFAULT '[]',
      pontos_fortes JSONB NOT NULL DEFAULT '[]',
      pontos_melhoria JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS resultado VARCHAR(20);`);
  await pool.query(`ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC;`);

  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE roteiros ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE reunioes ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(
    `ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`
  );

  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS especialidade VARCHAR(255);`);
  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade VARCHAR(255);`);
  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plano VARCHAR(255);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_tarefas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(500) NOT NULL DEFAULT '',
      participantes JSONB NOT NULL DEFAULT '[]',
      itens JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}
