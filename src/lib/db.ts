import { Pool } from "pg";

// Suporta dois formatos de configuração:
// - Connection string (Vercel + Neon/Vercel Postgres injeta DATABASE_URL /
//   POSTGRES_URL automaticamente ao conectar o banco pelo marketplace).
// - Variáveis separadas DB_HOST/DB_PORT/etc (setup manual, ex: Easypanel).
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });

export default pool;
