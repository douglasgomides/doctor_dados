import pool from "@/lib/db";

export interface ClienteBasico {
  id: string;
  nome: string;
}

// Cliente novo sem responsável fica invisível pros alertas de pendência
// (que dependem do WhatsApp do responsável pra saber quem avisar) até
// alguém entrar em Clientes e atribuir manualmente — na prática, isso podia
// levar dias. Distribui em round-robin entre os membros da equipe
// (role='team') com menos clientes ativos hoje, então todo cliente novo já
// nasce com dono. Sem equipe cadastrada ainda, cai em null (comportamento
// anterior) — a auto-atribuição pressupõe que Usuários já tem gente real.
async function proximoResponsavelRoundRobin(): Promise<string | null> {
  const result = await pool.query(
    `SELECT u.id
     FROM dash_users u
     LEFT JOIN clientes c ON c.responsavel_id = u.id AND c.is_test = false
     WHERE u.role = 'team'
     GROUP BY u.id, u.created_at
     ORDER BY COUNT(c.id) ASC, u.created_at ASC
     LIMIT 1`
  );
  return result.rows.length > 0 ? result.rows[0].id : null;
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
    const responsavelId = await proximoResponsavelRoundRobin();
    const inserted = await pool.query(
      "INSERT INTO clientes (nome, responsavel_id) VALUES ($1, $2) RETURNING id",
      [nome, responsavelId]
    );
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
// como aparecem no Google Meet) com o cadastro de clientes ativos. Retorna
// TODOS os clientes ativos batidos entre os participantes — 0 significa
// "não é uma reunião de cliente", 1 é o caso comum (mentoria 1:1), e mais
// de 1 é uma reunião em grupo (vários médicos-clientes na mesma call).
// batidos entre os participantes, não só quando dá exatamente um. Usada
// pra reunião em grupo (vários médicos-clientes na mesma call), onde
// "mais de um bateu" é o caso esperado, não um alerta de ambiguidade.
export async function findClientesAtivosByParticipantes(
  participantes: string[]
): Promise<ClienteBasico[]> {
  const result = await pool.query<ClienteBasico>(
    "SELECT id, nome FROM clientes WHERE ativo = true"
  );

  const encontrados = new Map<string, ClienteBasico>();
  for (const cliente of result.rows) {
    const bateu = participantes.some((participante) => nomesCorrespondem(participante, cliente.nome));
    if (bateu) encontrados.set(cliente.id, cliente);
  }

  return [...encontrados.values()];
}
