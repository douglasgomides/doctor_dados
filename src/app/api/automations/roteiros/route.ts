import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { validateRoteiro } from "@/lib/roteiro-validator";
import { findOrCreateClienteId } from "@/lib/clientes";
import { RoteiroFormat } from "@/types";

// Endpoint de escrita pra automação externa (n8n) importar roteiros
// automaticamente do Calendário (app Lovable "Calendário | Doctor Creator",
// tabela `contents`, Supabase). Não é protegido por sessão de usuário — é
// chamado por um serviço, não por um navegador logado — então usa o mesmo
// segredo compartilhado de /api/automations/alerts, no header
// "x-automation-secret".
//
// Disparado quando um item de `contents` muda de status pra "aprovacao"
// (roteiro pronto, aguardando aprovação) — o n8n consulta esse status e
// manda o `script` pra cá pra validar automaticamente, em vez do
// colaborador colar manualmente em Roteiros.

const SYSTEM_AUTHOR_EMAIL = "automacao.calendario@doctorcreator.internal";
const SYSTEM_AUTHOR_NAME = "Automação (Calendário)";

// content_type do Calendário -> formato validado aqui. Tipos sem
// equivalente direto (youtube, podcast, live, imagem) são ignorados —
// "reels_9s" também fica de fora por enquanto porque o padrão ouro de
// Reels (15–90s de leitura) não se aplica a um formato de 9 segundos.
const FORMATO_POR_TIPO: Record<string, RoteiroFormat | undefined> = {
  reels: "reel",
  carrossel: "carrossel",
  stories: "stories",
};

const DIACRITICOS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

function semAcento(s: string): string {
  return s.normalize("NFD").replace(DIACRITICOS_RE, "").toLowerCase();
}

async function getOrCreateSystemAuthorId(): Promise<{ id: string; name: string }> {
  const existing = await pool.query(
    "SELECT id, name FROM dash_users WHERE email = $1",
    [SYSTEM_AUTHOR_EMAIL]
  );
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, name: existing.rows[0].name };
  }

  const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);
  const inserted = await pool.query(
    `INSERT INTO dash_users (email, name, password, role)
     VALUES ($1, $2, $3, 'team')
     RETURNING id, name`,
    [SYSTEM_AUTHOR_EMAIL, SYSTEM_AUTHOR_NAME, randomPassword]
  );
  return { id: inserted.rows[0].id, name: inserted.rows[0].name };
}

// Tenta casar o nome do responsável no Calendário com um usuário real da
// equipe aqui (pelo primeiro nome, sem acento). Se não achar exatamente um,
// usa o autor de sistema — não arrisca atribuir a pessoa errada, o que
// distorceria a Performance dela.
async function acharAutorPorNome(
  nome: string | null | undefined
): Promise<{ id: string; name: string }> {
  if (nome && nome.trim()) {
    const equipe = await pool.query("SELECT id, name FROM dash_users WHERE role = 'team'");
    const primeiroNome = semAcento(nome).split(" ")[0];
    const encontrados = equipe.rows.filter((u) => semAcento(u.name).includes(primeiroNome));
    if (encontrados.length === 1) {
      return { id: encontrados[0].id, name: encontrados[0].name };
    }
  }
  return getOrCreateSystemAuthorId();
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.AUTOMATION_API_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "AUTOMATION_API_SECRET não configurado no servidor." },
        { status: 500 }
      );
    }

    const providedSecret = req.headers.get("x-automation-secret");
    if (!providedSecret || providedSecret !== secret) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { contentId, doctorName, assigneeName, title, tipo, script } = await req.json();

    if (!doctorName || typeof doctorName !== "string" || !doctorName.trim()) {
      return NextResponse.json({ error: "Informe o nome do médico." }, { status: 400 });
    }

    const format = FORMATO_POR_TIPO[tipo as string];
    if (!format) {
      return NextResponse.json({
        skipped: true,
        reason: `Tipo de conteúdo "${tipo}" não tem validador de qualidade ainda.`,
        contentId: contentId || null,
      });
    }

    if (!script || typeof script !== "string" || !script.trim()) {
      return NextResponse.json({
        skipped: true,
        reason: "Roteiro está vazio — nada pra validar ainda.",
        contentId: contentId || null,
      });
    }

    const validation = await validateRoteiro(format, script);
    const author = await acharAutorPorNome(assigneeName);
    const clientId = await findOrCreateClienteId(doctorName);

    const result = await pool.query(
      `INSERT INTO roteiros (author_id, author_name, client_id, client_name, format, title, content, status, score, issues)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        author.id,
        author.name,
        clientId,
        doctorName.trim(),
        format,
        (title || "").trim(),
        script,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
      ]
    );

    return NextResponse.json({
      skipped: false,
      roteiroId: result.rows[0].id,
      contentId: contentId || null,
      status: validation.status,
      score: validation.score,
      autorNome: author.name,
    });
  } catch (error) {
    console.error("Erro ao importar roteiro automaticamente:", error);
    return NextResponse.json(
      { error: "Erro ao importar roteiro automaticamente." },
      { status: 500 }
    );
  }
}
