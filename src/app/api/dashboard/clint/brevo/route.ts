import { NextResponse } from "next/server";
import pool from "@/lib/db";

// Cruzamento Brevo × Clint para o dashboard de Inteligência Comercial.
// Protegido por sessão master — já coberto pelo prefixo /api/dashboard em
// src/proxy.ts. Lê só do espelho local (brevo_contacts/brevo_campaigns,
// ver src/lib/brevo-sync.ts), nunca da API da Brevo diretamente.
//
// O cruzamento com a Clint é feito por e-mail (LOWER(email) dos dois
// lados) — não existe um ID compartilhado entre as duas plataformas.

interface CampaignRow {
  id: string;
  name: string;
  subject: string | null;
  type: string;
  status: string;
  sentDate: string | null;
  sent: number | null;
  delivered: number | null;
  uniqueViews: number | null;
  uniqueClicks: number | null;
  unsubscriptions: number | null;
  opensRatePct: number | null;
  clickRatePct: number | null;
}

export async function GET() {
  try {
    const [overviewResult, crossRefResult, campaignsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_contacts,
          COUNT(*) FILTER (WHERE email_blacklisted) AS total_blacklisted,
          (SELECT COUNT(*) FROM brevo_campaigns WHERE status = 'sent') AS total_campaigns_sent,
          (SELECT COALESCE(SUM((stats->>'sent')::int), 0) FROM brevo_campaigns WHERE status = 'sent') AS total_sent,
          (SELECT COALESCE(SUM((stats->>'uniqueViews')::int), 0) FROM brevo_campaigns WHERE status = 'sent') AS total_unique_opens,
          (SELECT COALESCE(SUM((stats->>'uniqueClicks')::int), 0) FROM brevo_campaigns WHERE status = 'sent') AS total_unique_clicks,
          (SELECT COALESCE(SUM((stats->>'delivered')::int), 0) FROM brevo_campaigns WHERE status = 'sent') AS total_delivered
        FROM brevo_contacts
      `),
      pool.query(`
        WITH clint_emails AS (
          SELECT DISTINCT LOWER(email) AS email FROM clint_contacts WHERE email IS NOT NULL AND email <> ''
        )
        SELECT
          (SELECT COUNT(*) FROM clint_emails) AS total_clint_with_email,
          COUNT(*) FILTER (WHERE bc.id IS NOT NULL) AS matched_in_brevo,
          COUNT(*) FILTER (WHERE bc.id IS NOT NULL AND bc.email_blacklisted) AS blacklisted_matched
        FROM clint_emails ce
        LEFT JOIN brevo_contacts bc ON LOWER(bc.email) = ce.email
      `),
      pool.query(`
        SELECT id, name, subject, type, status, sent_date, stats
        FROM brevo_campaigns
        WHERE status = 'sent'
        ORDER BY sent_date DESC NULLS LAST
        LIMIT 20
      `),
    ]);

    const ov = overviewResult.rows[0];
    const cr = crossRefResult.rows[0];

    const campaigns: CampaignRow[] = campaignsResult.rows.map((row) => {
      const stats = row.stats ?? {};
      const sent = stats.sent ?? null;
      const delivered = stats.delivered ?? null;
      const uniqueViews = stats.uniqueViews ?? null;
      const uniqueClicks = stats.uniqueClicks ?? null;
      return {
        id: row.id,
        name: row.name,
        subject: row.subject,
        type: row.type,
        status: row.status,
        sentDate: row.sent_date,
        sent,
        delivered,
        uniqueViews,
        uniqueClicks,
        unsubscriptions: stats.unsubscriptions ?? null,
        opensRatePct: delivered && delivered > 0 && uniqueViews !== null ? (uniqueViews / delivered) * 100 : null,
        clickRatePct: delivered && delivered > 0 && uniqueClicks !== null ? (uniqueClicks / delivered) * 100 : null,
      };
    });

    const totalDelivered = Number(ov.total_delivered);
    const totalUniqueOpens = Number(ov.total_unique_opens);
    const totalUniqueClicks = Number(ov.total_unique_clicks);

    return NextResponse.json({
      overview: {
        totalContacts: Number(ov.total_contacts),
        totalBlacklisted: Number(ov.total_blacklisted),
        totalCampaignsSent: Number(ov.total_campaigns_sent),
        totalSent: Number(ov.total_sent),
        totalUniqueOpens,
        totalUniqueClicks,
        avgOpenRatePct: totalDelivered > 0 ? (totalUniqueOpens / totalDelivered) * 100 : null,
        avgClickRatePct: totalDelivered > 0 ? (totalUniqueClicks / totalDelivered) * 100 : null,
      },
      crossReference: {
        totalClintWithEmail: Number(cr.total_clint_with_email),
        matchedInBrevo: Number(cr.matched_in_brevo),
        matchedPct:
          Number(cr.total_clint_with_email) > 0
            ? (Number(cr.matched_in_brevo) / Number(cr.total_clint_with_email)) * 100
            : null,
        blacklistedMatched: Number(cr.blacklisted_matched),
      },
      campaigns,
    });
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard Brevo:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro ao carregar dados do dashboard Brevo: ${detail}` }, { status: 500 });
  }
}
