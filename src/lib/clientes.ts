import pool from "@/lib/db";

// Toda submissão de roteiro/reunião carrega um nome de cliente em texto
// livre (o time não deveria precisar cadastrar o médico antes de validar um
// conteúdo). Essa função garante que exista um registro em `clientes`
// correspondente, criando um na primeira vez que o nome aparece — é assim
// que o cadastro de clientes (responsável, WhatsApp, metas) fica populado
// sem exigir um passo manual extra do time.
export async function findOrCreateClienteId(rawNome: string): Promise<string> {
  const nome = rawNome.trim();

  const existing = await pool.query("SELECT id FROM clientes WHERE LOWER(nome) = LOWER($1)", [
    nome,
  ]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  try {
    const inserted = await pool.query("INSERT INTO clientes (nome) VALUES ($1) RETURNING id", [
      nome,
    ]);
    return inserted.rows[0].id;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any)?.code === "23505") {
      const retry = await pool.query("SELECT id FROM clientes WHERE LOWER(nome) = LOWER($1)", [
        nome,
      ]);
      if (retry.rows.length > 0) return retry.rows[0].id;
    }
    throw error;
  }
}
