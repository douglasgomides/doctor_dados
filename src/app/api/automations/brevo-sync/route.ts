import { NextRequest, NextResponse } from "next/server";
import { syncBrevoResource, BrevoResource } from "@/lib/brevo-sync";

// Eleva o limite de execução da função, mesmo padrão do clint-sync.
export const maxDuration = 60;

// Endpoint de sincronização Brevo → Postgres local, disparado externamente
// (n8n, ou manualmente). Fica de fora dos prefixos protegidos por sessão em
// src/proxy.ts, de propósito — igual ao clint-sync.
//
// Usa um segredo PRÓPRIO (BREVO_SYNC_SECRET), separado do
// AUTOMATION_API_SECRET e do CLINT_SYNC_SECRET.
//
// Retomável: cada chamada processa contatos/campanhas até esgotar o
// orçamento de tempo (padrão 45s) e devolve done=false + o offset onde
// parou; a próxima chamada com o mesmo resource continua dali. Chame
// repetidamente (n8n em loop, ou manualmente) até done=true.
//
// POST /api/automations/brevo-sync?resource=brevo_contacts|brevo_campaigns
const VALID_RESOURCES: BrevoResource[] = ["brevo_contacts", "brevo_campaigns"];

export async function POST(req: NextRequest) {
  const secret = process.env.BREVO_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "BREVO_SYNC_SECRET não configurado no servidor." }, { status: 500 });
  }

  const providedSecret = req.headers.get("x-automation-secret");
  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resourceParam = req.nextUrl.searchParams.get("resource");
  if (!resourceParam || !VALID_RESOURCES.includes(resourceParam as BrevoResource)) {
    return NextResponse.json(
      { error: `Parâmetro "resource" inválido. Use um de: ${VALID_RESOURCES.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const result = await syncBrevoResource(resourceParam as BrevoResource);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Erro ao sincronizar Brevo (${resourceParam}):`, error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha na sincronização: ${message}` }, { status: 502 });
  }
}
