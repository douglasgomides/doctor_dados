import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

// Endpoint de leitura pra automação externa (n8n) buscar periodicamente
// "o que precisa de aviso agora" e disparar os WhatsApps pro responsável
// de cada cliente. Não é protegido por sessão de usuário (não fica sob o
// prefixo /api/dashboard no middleware) — é chamado por um serviço, não por
// um navegador logado — então usa um segredo compartilhado no header
// "x-automation-secret", no mesmo padrão de /api/db/init.

const PENDING_LIMIT = 100;

interface Alerta {
  tipo: "roteiro_ajustar" | "reuniao_ajustar" | "cadencia_roteiros" | "cadencia_reunioes";
  clienteNome: string;
  responsavelNome: string | null;
  responsavelWhatsapp: string | null;
  mensagem: string;
  detalhe: Record<string, unknown>;
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

    const [roteirosResult, reunioesResult, clientesResult] = await Promise.all([
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
        `SELECT c.nome, c.roteiros_por_semana, c.reunioes_por_mes,
                u.name AS responsavel_name, u.telefone_whatsapp AS responsavel_whatsapp,
                (SELECT COUNT(*) FROM roteiros r
                 WHERE r.client_id = c.id AND r.created_at > NOW() - INTERVAL '7 days') AS roteiros_semana,
                (SELECT COUNT(*) FROM reunioes re
                 WHERE re.client_id = c.id AND re.created_at > NOW() - INTERVAL '30 days') AS reunioes_mes
         FROM clientes c
         LEFT JOIN dash_users u ON u.id = c.responsavel_id
         WHERE c.ativo = true`
      ),
    ]);

    const alertas: Alerta[] = [];

    for (const row of roteirosResult.rows) {
      alertas.push({
        tipo: "roteiro_ajustar",
        clienteNome: row.client_name,
        responsavelNome: row.responsavel_name,
        responsavelWhatsapp: row.responsavel_whatsapp,
        mensagem: `O roteiro de ${row.format} para ${row.client_name} (enviado por ${row.author_name}, nota ${row.score}/100) está pendente de ajuste.`,
        detalhe: {
          roteiroId: row.id,
          format: row.format,
          score: row.score,
          autorNome: row.author_name,
          criadoEm: new Date(row.created_at).toISOString(),
        },
      });
    }

    for (const row of reunioesResult.rows) {
      alertas.push({
        tipo: "reuniao_ajustar",
        clienteNome: row.client_name,
        responsavelNome: row.responsavel_name,
        responsavelWhatsapp: row.responsavel_whatsapp,
        mensagem: `A reunião de ${row.tipo} com ${row.client_name} (registrada por ${row.author_name}, nota ${row.score}/100) está pendente de ajuste.`,
        detalhe: {
          reuniaoId: row.id,
          tipo: row.tipo,
          score: row.score,
          autorNome: row.author_name,
          criadoEm: new Date(row.created_at).toISOString(),
        },
      });
    }

    for (const row of clientesResult.rows) {
      const roteirosSemana = Number(row.roteiros_semana);
      const reunioesMes = Number(row.reunioes_mes);

      if (row.roteiros_por_semana != null && roteirosSemana < row.roteiros_por_semana) {
        alertas.push({
          tipo: "cadencia_roteiros",
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
