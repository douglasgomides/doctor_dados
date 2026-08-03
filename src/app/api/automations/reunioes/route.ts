import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { validateReuniao } from "@/lib/reuniao-validator";
import { findClientesAtivosByParticipantes } from "@/lib/clientes";
import { ReuniaoTipo } from "@/types";

// Endpoint de escrita pra automação externa (n8n) importar transcrições do
// Meet automaticamente. Não é protegido por sessão de usuário (não fica sob
// nenhum prefixo autenticado no middleware) — é chamado por um serviço, não
// por um navegador logado — então usa o mesmo segredo compartilhado de
// /api/automations/alerts, no header "x-automation-secret".
//
// A pasta do Drive onde o Meet salva transcrições recebe TODO tipo de
// reunião (dailies internas, comercial, reuniões com médico). Este endpoint
// casa os participantes com o cadastro de clientes ativos: 0 clientes
// batidos = não é reunião de cliente, retorna "skipped" (200, não é erro) e
// não grava nada; 2+ clientes = reunião em grupo (tipo sempre "grupo"),
// gravada com client_id nulo (não tem "o" cliente) e vinculada a todos os
// clientes envolvidos via reuniao_clientes, pra aparecer no histórico de
// cada um. Com 1 cliente só, o tipo (mentoria/onboarding/pontual) é
// inferido do nome do arquivo salvo pelo Meet — por isso o padrão de
// nomear a transcrição com a palavra certa (ex: "Onboarding - Dra. Fulana",
// "Pontual - Dr. Beltrano") importa tanto quanto nomear "Comercial"/"Daily".

const SYSTEM_AUTHOR_EMAIL = "automacao.meet@doctorcreator.internal";
const DEFAULT_TIPO: ReuniaoTipo = "mentoria";

// Faixa Unicode dos diacríticos combináveis, montada por código de
// caractere (não por glifo) — mesmo motivo do lib/clientes.ts.
const DIACRITICOS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

function semAcento(s: string): string {
  return s.normalize("NFD").replace(DIACRITICOS_RE, "").toLowerCase();
}

// O nome do arquivo salvo pelo Meet é o único sinal disponível pra saber o
// tipo da reunião com um cliente único — mesma lógica de título já usada
// pelo workflow do n8n pra separar comercial/daily. Se o título não trouxer
// nenhuma palavra-chave reconhecida, cai no padrão (mentoria).
function inferirTipoPeloTitulo(titulo: string): ReuniaoTipo | null {
  const t = semAcento(titulo || "");
  if (t.includes("onboarding")) return "onboarding";
  if (t.includes("pontual") || t.includes("emergencial") || t.includes("urgente")) return "pontual";
  if (t.includes("mentoria")) return "mentoria";
  return null;
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
    [SYSTEM_AUTHOR_EMAIL, "Automação (Meet)", randomPassword]
  );
  return { id: inserted.rows[0].id, name: inserted.rows[0].name };
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

    const { titulo, participantes, transcricao } = await req.json();

    if (!Array.isArray(participantes) || participantes.length === 0) {
      return NextResponse.json(
        { error: "Informe a lista de participantes da reunião." },
        { status: 400 }
      );
    }
    if (!transcricao || typeof transcricao !== "string" || !transcricao.trim()) {
      return NextResponse.json({ error: "A transcrição não pode estar vazia." }, { status: 400 });
    }

    const clientes = await findClientesAtivosByParticipantes(participantes);
    if (clientes.length === 0) {
      return NextResponse.json({
        skipped: true,
        reason:
          "Nenhum cliente ativo identificado com segurança entre os participantes — provavelmente não é uma reunião de cliente.",
        titulo: titulo || null,
      });
    }

    const isGrupo = clientes.length > 1;
    const tipoFinal: ReuniaoTipo = isGrupo
      ? "grupo"
      : inferirTipoPeloTitulo(titulo) ?? DEFAULT_TIPO;
    const clientIdFinal = isGrupo ? null : clientes[0].id;
    const clientNameFinal = isGrupo ? clientes.map((c) => c.nome).join(" + ") : clientes[0].nome;

    const validation = await validateReuniao(tipoFinal, transcricao);
    const author = await getOrCreateSystemAuthorId();

    const result = await pool.query(
      `INSERT INTO reunioes (author_id, author_name, client_id, client_name, tipo, content, status, score, issues, suggested_agenda, suggested_content_ideas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        author.id,
        author.name,
        clientIdFinal,
        clientNameFinal,
        tipoFinal,
        transcricao,
        validation.status,
        validation.score,
        JSON.stringify(validation.issues),
        JSON.stringify(validation.suggestedAgenda),
        JSON.stringify(validation.suggestedContentIdeas),
      ]
    );
    const reuniaoId = result.rows[0].id;

    for (const cliente of clientes) {
      await pool.query(
        `INSERT INTO reuniao_clientes (reuniao_id, cliente_id, cliente_nome) VALUES ($1, $2, $3)`,
        [reuniaoId, cliente.id, cliente.nome]
      );
    }

    return NextResponse.json({
      skipped: false,
      reuniaoId,
      clienteNome: clientNameFinal,
      status: validation.status,
      score: validation.score,
    });
  } catch (error) {
    console.error("Erro ao importar transcrição automaticamente:", error);
    return NextResponse.json(
      { error: "Erro ao importar transcrição automaticamente." },
      { status: 500 }
    );
  }
}
