import pool from "@/lib/db";
import { URGENTE_HORAS, horasDesde } from "@/lib/constants";
import { Pendencia } from "@/types";

// Agregação central de "o que precisa de atenção agora" — extraída de
// /api/automations/alerts (que só vira mensagem de WhatsApp 1x/dia, às 9h,
// via n8n) pra também alimentar /api/dashboard/pendencias (a Central de
// Pendências dentro do próprio app, disponível sob demanda pra quem tem
// sessão). As duas rotas chamam a mesma função — nenhuma lógica duplicada.

const PENDING_LIMIT = 100;
const NEGOCIACAO_PARADA_DIAS = 7;
const CLIENTE_INATIVO_DIAS = 30;

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

export async function buscarPendencias(): Promise<Pendencia[]> {
  const [
    roteirosResult,
    reunioesResult,
    comercialResult,
    equipeResult,
    clientesResult,
    negociacaoParadaResult,
    atividadeClientesResult,
  ] = await Promise.all([
      pool.query(
        `SELECT r.id, r.client_name, r.format, r.score, r.author_name, r.created_at,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp
         FROM roteiros r
         LEFT JOIN clientes c ON c.id = r.client_id
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE r.status = 'ajustar' AND r.is_test = false
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
         WHERE re.status = 'ajustar' AND re.is_test = false
         ORDER BY re.created_at DESC
         LIMIT $1`,
        [PENDING_LIMIT]
      ),
      pool.query(
        `SELECT id, titulo, participantes, score, created_at
         FROM comercial_analises
         WHERE status = 'ajustar' AND is_test = false
         ORDER BY created_at DESC
         LIMIT $1`,
        [PENDING_LIMIT]
      ),
      pool.query(`SELECT name, telefone_whatsapp FROM dash_users`),
      pool.query(
        `SELECT c.nome, c.roteiros_por_semana, c.reunioes_por_mes,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp,
                (SELECT COUNT(*) FROM roteiros r
                 WHERE r.client_id = c.id AND r.is_test = false
                   AND r.created_at > NOW() - INTERVAL '7 days') AS roteiros_semana,
                (SELECT COUNT(DISTINCT combined.id) FROM (
                   SELECT re.id, re.created_at FROM reunioes re
                   WHERE re.client_id = c.id AND re.is_test = false
                   UNION
                   SELECT re2.id, re2.created_at FROM reunioes re2
                   JOIN reuniao_clientes rc ON rc.reuniao_id = re2.id
                   WHERE rc.cliente_id = c.id AND re2.is_test = false
                 ) AS combined
                 WHERE combined.created_at > NOW() - INTERVAL '30 days') AS reunioes_mes
         FROM clientes c
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE c.ativo = true AND c.is_test = false`
      ),
      // Negociação comercial que parou de andar — "em_negociacao" sem
      // nenhuma atualização (mudar resultado, editar) há muitos dias.
      pool.query(
        `SELECT id, titulo, participantes, updated_at
         FROM comercial_analises
         WHERE resultado = 'em_negociacao' AND is_test = false
           AND updated_at < NOW() - INTERVAL '${NEGOCIACAO_PARADA_DIAS} days'
         ORDER BY updated_at ASC
         LIMIT $1`,
        [PENDING_LIMIT]
      ),
      // Última atividade real (roteiro ou reunião) de cada cliente ativo —
      // rede de segurança pra cliente sem meta de cadência cadastrada, que
      // hoje nunca aparece como pendência mesmo abandonado.
      pool.query(
        `SELECT c.nome, c.created_at,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp,
                (SELECT MAX(r.created_at) FROM roteiros r
                 WHERE r.client_id = c.id AND r.is_test = false) AS ultimo_roteiro,
                (SELECT MAX(x.created_at) FROM (
                   SELECT re.created_at FROM reunioes re
                   WHERE re.client_id = c.id AND re.is_test = false
                   UNION ALL
                   SELECT re2.created_at FROM reunioes re2
                   JOIN reuniao_clientes rc ON rc.reuniao_id = re2.id
                   WHERE rc.cliente_id = c.id AND re2.is_test = false
                 ) x) AS ultima_reuniao
         FROM clientes c
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE c.ativo = true AND c.is_test = false`
      ),
    ]);

  const pendencias: Pendencia[] = [];

  for (const row of roteirosResult.rows) {
    const criadoEm = new Date(row.created_at).toISOString();
    const urgente = horasDesde(criadoEm) >= URGENTE_HORAS;
    pendencias.push({
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
    pendencias.push({
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
    pendencias.push({
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
      pendencias.push({
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
      pendencias.push({
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

  for (const row of negociacaoParadaResult.rows) {
    const diasParada = Math.floor(
      (Date.now() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    const participantes: string[] = row.participantes || [];
    const vendedor = acharVendedorPorParticipantes(participantes, equipeResult.rows);
    pendencias.push({
      tipo: "comercial_negociacao_parada",
      urgente: false,
      clienteNome: row.titulo || "Call comercial",
      responsavelNome: vendedor?.name ?? null,
      responsavelWhatsapp: vendedor?.telefone_whatsapp ?? null,
      mensagem: `A negociação "${row.titulo || "sem título"}" está marcada como "em negociação" há ${diasParada} dias sem nenhuma atualização. Vale confirmar se ainda está viva.`,
      detalhe: { comercialId: row.id, diasParada, participantes },
    });
  }

  for (const row of atividadeClientesResult.rows) {
    const datas = [row.ultimo_roteiro, row.ultima_reuniao, row.created_at]
      .filter(Boolean)
      .map((d) => new Date(d).getTime());
    const ultimaAtividade = Math.max(...datas);
    const diasSemAtividade = Math.floor((Date.now() - ultimaAtividade) / (1000 * 60 * 60 * 24));

    if (diasSemAtividade >= CLIENTE_INATIVO_DIAS) {
      pendencias.push({
        tipo: "cliente_inativo",
        urgente: false,
        clienteNome: row.nome,
        responsavelNome: row.responsavel_name,
        responsavelWhatsapp: row.responsavel_whatsapp,
        mensagem: `${row.nome} está sem nenhum roteiro ou reunião registrada há ${diasSemAtividade} dias — vale confirmar se o cliente ainda está ativo.`,
        detalhe: { diasSemAtividade },
      });
    }
  }

  return pendencias;
}
