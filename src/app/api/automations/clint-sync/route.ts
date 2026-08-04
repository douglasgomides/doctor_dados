import { NextRequest, NextResponse } from "next/server";
import { syncResource, ClintResource } from "@/lib/clint-sync";

// Eleva o limite de execução da função (padrão do Vercel costuma ser 10-15s)
// pra caber mais páginas por chamada de sincronização. Se o plano não
// suportar 60s, o Vercel usa o teto do plano mesmo assim — não quebra.
export const maxDuration = 60;

// Endpoint de sincronização Clint → Postgres local, disparado externamente
// (n8n, ou manualmente) — mesmo padrão de segredo compartilhado dos outros
// automations (ver src/app/api/automations/comercial/route.ts). Fica de
// fora dos prefixos protegidos por sessão em src/proxy.ts, de propósito.
//
// Retomável: cada chamada processa contatos/negócios até esgotar o
// orçamento de tempo (padrão 45s) e devolve done=false + a página onde
// parou; a próxima chamada com o mesmo resource continua dali. Chame
// repetidamente (n8n em loop, ou manualmente) até done=true.
//
// POST /api/automations/clint-sync?resource=contacts|deals|origins|tags
const VALID_RESOURCES: ClintResource[] = ["contacts", "deals", "origins", "tags"];

export async function POST(req: NextRequest) {
  const secret = process.env.AUTOMATION_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "AUTOMATION_API_SECRET não configurado no servidor." }, { status: 500 });
  }

  const providedSecret = req.headers.get("x-automation-secret");
  if (!providedSecret || providedSecret !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resourceParam = req.nextUrl.searchParams.get("resource");
  if (!resourceParam || !VALID_RESOURCES.includes(resourceParam as ClintResource)) {
    return NextResponse.json(
      { error: `Parâmetro "resource" inválido. Use um de: ${VALID_RESOURCES.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const result = await syncResource(resourceParam as ClintResource);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Erro ao sincronizar Clint (${resourceParam}):`, error);
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ error: `Falha na sincronização: ${message}` }, { status: 502 });
  }
}
