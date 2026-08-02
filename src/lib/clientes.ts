import pool from "@/lib/db";

interface ClienteBasico {
  id: string;
  nome: string;
}

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

// Faixa Unicode dos diacríticos combináveis (0300–036F), montada por código
// de caractere para não depender de digitar o glifo combinável no arquivo.
const DIACRITICOS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

function palavrasNormalizadas(nome: string): Set<string> {
  const semAcento = nome.normalize("NFD").replace(DIACRITICOS_RE, "").toLowerCase();
  const semHonorifico = semAcento.replace(/\b(dr|dra|doutor|doutora)\b\.?/g, " ");
  return new Set(semHonorifico.split(/\s+/).filter(Boolean));
}

function nomesCorrespondem(a: string, b: string): boolean {
  const palavrasA = palavrasNormalizadas(a);
  const palavrasB = palavrasNormalizadas(b);
  const [menor, maior] = palavrasA.size <= palavrasB.size ? [palavrasA, palavrasB] : [palavrasB, palavrasA];
  if (menor.size === 0) return false;
  return [...menor].every((palavra) => maior.has(palavra));
}

// Cruza a lista de participantes de uma transcrição (nomes em texto livre,
// como aparecem no Google Meet) com o cadastro de clientes ativos. Só
// retorna um cliente quando exatamente um bate — nenhum ou mais de um
// resultado significa "não dá pra saber com segurança", e quem chama deve
// tratar isso como "não é uma reunião de cliente" em vez de arriscar
// registrar no cliente errado.
export async function findClienteAtivoByParticipantes(
  participantes: string[]
): Promise<ClienteBasico | null> {
  const result = await pool.query<ClienteBasico>(
    "SELECT id, nome FROM clientes WHERE ativo = true"
  );

  const encontrados = new Map<string, ClienteBasico>();
  for (const cliente of result.rows) {
    const bateu = participantes.some((participante) => nomesCorrespondem(participante, cliente.nome));
    if (bateu) encontrados.set(cliente.id, cliente);
  }

  if (encontrados.size !== 1) return null;
  return [...encontrados.values()][0];
}
