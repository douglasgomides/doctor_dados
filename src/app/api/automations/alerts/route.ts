import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Endpoint de leitura pra automação externa (n8n) buscar periodicamente
// "o que precisa de aviso agora" e disparar os WhatsApps pro responsável
// de cada cliente. Não é protegido por sessão de usuário (não fica sob o
// prefixo /api/dashboard no middleware) — é chamado por um serviço, não por
// um navegador logado — então usa um segredo compartilhado no header
// "x-automation-secret", no mesmo padrão de /api/db/init.

const PENDING_LIMIT = 100;
const URGENTE_HORAS = 48;

interface Alerta {
  tipo:
    | "roteiro_ajustar"
    | "reuniao_ajustar"
    | "comercial_ajustar"
    | "cadencia_roteiros"
    | "cadencia_reunioes";
  urgente: boolean;
  clienteNome: string;
  responsavelNome: string | null;
  responsavelWhatsapp: string | null;
  mensagem: string;
  detalhe: Record<string, unknown>;
}

function horasDesde(dataIso: string): number {
  return (Date.now() - new Date(dataIso).getTime()) / (1000 * 60 * 60);
}

// Faixa Unicode dos diacríticos combináveis, montada por código de
// caractere (não por glifo) — mesmo motivo do lib/clientes.ts.
const DIACRITICOS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

function semAcento(s: string): string {
  return s.normalize("NFD").replace(DIACRITICOS_RE, "").toLowerCase();
}

// Calls comerciais não têm cliente/responsável cadastrado (não são
// atendimento de um médico já cliente) — o "responsável" aqui é o
// vendedor que participou da call. Tenta achar, entre os participantes em
// texto livre, exatamente um membro da equipe (dash_users) pelo nome; se
// achar 0 ou mais de 1, não arrisca notificar a pessoa errada.
function acharVendedorPorParticipantes(
  participantes: string[],
  equipe: { name: string; telefone_whatsapp: string | null }[]
): { name: string; telefone_whatsapp: string | null } | null {
  const encontrados = equipe.filter((membro) =>
    participantes.some((p) => semAcento(p).includes(semAcento(membro.name).split(" ")[0]))
  );
  const unicos = [...new Map(encontrados.map((m) => [m.name, m])).values()];
  return unicos.length === 1 ? unicos[0] : null;
}

export async function GET(req: NextRequest) {
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

    const [roteirosResult, reunioesResult, comercialResult, equipeResult, clientesResult] =
      await Promise.all([
      pool.query(
        `SELECT r.id, r.client_name, r.format, r.score, r.author_name, r.created_at,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp
         FROM roteiros r
         LEFT JOIN clientes c ON c.id = r.client_id
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE r.status = 'ajustar'
         ORDER BY r.created_at DESC
         LIMIT $1`,
        [PENDING_LIMIT]
      ),
      pool.query(
        `SELECT re.id, re.client_name, re.tipo, re.score, re.author_name, re.created_at,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp
         FROM reunioes re
         LEFT JOIN clientes c ON c.id = re.client_id
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE re.status = 'ajustar'
         ORDER BY re.created_at DESC
         LIMIT $1`,
        [PENDING_LIMIT]
      ),
      pool.query(
        `SELECT id, titulo, participantes, score, created_at
         FROM comercial_analises
         WHERE status = 'ajustar'
         ORDER BY created_at DESC
         LIMIT $1`,
        [PENDING_LIMIT]
      ),
      pool.query(`SELECT name, telefone_whatsapp FROM dash_users`),
      pool.query(
        `SELECT c.nome, c.roteiros_por_semana, c.reunioes_por_mes,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp,
                (SELECT COUNT(*) FROM roteiros r
                 WHERE r.client_id = c.id AND r.created_at > NOW() - INTERVAL '7 days') AS roteiros_semana,
                (SELECT COUNT(DISTINCT combined.id) FROM (
                   SELECT re.id, re.created_at FROM reunioes re WHERE re.client_id = c.id
                   UNION
                   SELECT re2.id, re2.created_at FROM reunioes re2
                   JOIN reuniao_clientes rc ON rc.reuniao_id = re2.id
                   WHERE rc.cliente_id = c.id
                 ) AS combined
                 WHERE combined.created_at > NOW() - INTERVAL '30 days') AS reunioes_mes
         FROM clientes c
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE c.ativo = true`
      ),
    ]);

    const alertas: Alerta[] = [];

    for (const row of roteirosResult.rows) {
      const criadoEm = new Date(row.created_at).toISOString();
      const urgente = horasDesde(criadoEm) >= URGENTE_HORAS;
      alertas.push({
        tipo: "roteiro_ajustar",
        urgente,
        clienteNome: row.client_name,
        responsavelNome: row.responsavel_name,
        responsavelWhatsapp: row.responsavel_whatsapp,
        mensagem: `${urgente ? "[URGENTE] " : ""}O roteiro de ${row.format} para ${row.client_name} (enviado por ${row.author_name}, nota ${row.score}/100) está pendente de ajuste${urgente ? ` há mais de ${URGENTE_HORAS}h` : ""}.`,
        detalhe: {
          roteiroId: row.id,
          format: row.format,
          score: row.score,
          autorNome: row.author_name,
          criadoEm,
        },
      });
    }

    for (const row of reunioesResult.rows) {
      const criadoEm = new Date(row.created_at).toISOString();
      const urgente = horasDesde(criadoEm) >= URGENTE_HORAS;
      alertas.push({
        tipo: "reuniao_ajustar",
        urgente,
        clienteNome: row.client_name,
        responsavelNome: row.responsavel_name,
        responsavelWhatsapp: row.responsavel_whatsapp,
        mensagem: `${urgente ? "[URGENTE] " : ""}A reunião de ${row.tipo} com ${row.client_name} (registrada por ${row.author_name}, nota ${row.score}/100) está pendente de ajuste${urgente ? ` há mais de ${URGENTE_HORAS}h` : ""}.`,
        detalhe: {
          reuniaoId: row.id,
          tipo: row.tipo,
          score: row.score,
          autorNome: row.author_name,
          criadoEm,
        },
      });
    }

    for (const row of comercialResult.rows) {
      const criadoEm = new Date(row.created_at).toISOString();
      const urgente = horasDesde(criadoEm) >= URGENTE_HORAS;
      const participantes: string[] = row.participantes || [];
      const vendedor = acharVendedorPorParticipantes(participantes, equipeResult.rows);
      alertas.push({
        tipo: "comercial_ajustar",
        urgente,
        clienteNome: row.titulo || "Call comercial",
        responsavelNome: vendedor?.name ?? null,
        responsavelWhatsapp: vendedor?.telefone_whatsapp ?? null,
        mensagem: `${urgente ? "[URGENTE] " : ""}A call comercial "${row.titulo || "sem título"}" (nota ${row.score}/100) ficou marcada como "precisa de ajuste"${urgente ? ` há mais de ${URGENTE_HORAS}h` : ""}. Dá uma olhada nos pontos de melhoria antes da próxima call.`,
        detalhe: {
          comercialId: row.id,
          score: row.score,
          participantes,
          criadoEm,
        },
      });
    }

    for (const row of clientesResult.rows) {
      const roteirosSemana = Number(row.roteiros_semana);
      const reunioesMes = Number(row.reunioes_mes);

      if (row.roteiros_por_semana != null && roteirosSemana < row.roteiros_por_semana) {
        alertas.push({
          tipo: "cadencia_roteiros",
          urgente: false,
          clienteNome: row.nome,
          responsavelNome: row.responsavel_name,
          responsavelWhatsapp: row.responsavel_whatsapp,
          mensagem: `${row.nome} recebeu ${roteirosSemana} roteiro(s) nos últimos 7 dias, abaixo da meta de ${row.roteiros_por_semana}/semana.`,
          detalhe: { meta: row.roteiros_por_semana, atual: roteirosSemana, janelaDias: 7 },
        });
      }

      if (row.reunioes_por_mes != null && reunioesMes < row.reunioes_por_mes) {
        alertas.push({
          tipo: "cadencia_reunioes",
          urgente: false,
          clienteNome: row.nome,
          responsavelNome: row.responsavel_name,
          responsavelWhatsapp: row.responsavel_whatsapp,
          mensagem: `${row.nome} teve ${reunioesMes} reunião(ões) nos últimos 30 dias, abaixo da meta de ${row.reunioes_por_mes}/mês.`,
          detalhe: { meta: row.reunioes_por_mes, atual: reunioesMes, janelaDias: 30 },
        });
      }
    }

    return NextResponse.json({ geradoEm: new Date().toISOString(), alertas });
  } catch (error) {
    console.error("Erro ao montar alertas de automação:", error);
    return NextResponse.json({ error: "Erro ao montar alertas de automação." }, { status: 500 });
  }
}
