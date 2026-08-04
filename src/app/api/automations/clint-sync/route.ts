import { NextRequest, NextResponse } from "next/server";
import { syncResource, ClintResource } from "@/lib/clint-sync";

// Eleva o limite de execução da função (padrão do Vercel costuma ser 10-15s)
// pra caber mais páginas por chamada de sincronização. Se o plano não
// suportar 60s, o Vercel usa o teto do plano mesmo assim — não quebra.
export const maxDuration = 60;

// Endpoint de sincronização Clint → Postgres local, disparado externamente
// (n8n, ou manualmente). Fica de fora dos prefixos protegidos por sessão em
// src/proxy.ts, de propósito.
//
// Usa um segredo PRÓPRIO (CLINT_SYNC_SECRET), separado do
// AUTOMATION_API_SECRET compartilhado pelos outros automations — assim dá
// pra girar/gerar esse segredo sem afetar as automações que já existem
// (alerts, comercial, dailies, reuniões).
//
// Retomável: cada chamada processa contatos/negócios até esgotar o
// orçamento de tempo (padrão 45s) e devolve done=false + a página onde
// parou; a próxima chamada com o mesmo resource continua dali. Chame
// repetidamente (n8n em loop, ou manualmente) até done=true.
//
// POST /api/automations/clint-sync?resource=contacts|deals|origins|tags|messages|messages_nodeal|channels
// "messages" sincroniza chats + mensagens (WhatsApp/Instagram) dos
// contatos COM negócio associado (até 1500, mais recentes primeiro).
// "messages_nodeal" cobre o restante: contatos sem negócio mas com
// assinatura de lead só-Instagram (username preenchido, sem telefone) —
// ex: quem comentou/mandou DM via ManyChat mas nunca virou negócio no
// funil. Fila separada, resumível do mesmo jeito, mas sem o teto de 1500
// porque é justamente esse universo (54k+) que ficava de fora antes.
// "channels" sincroniza as contas de canal (WhatsApp/Instagram) e seu
// status de conexão — só 3 registros, uma chamada só.
const VALID_RESOURCES: ClintResource[] = [
  "contacts",
  "deals",
  "origins",
  "tags",
  "messages",
  "messages_nodeal",
  "channels",
];

export async function POST(req: NextRequest) {
  const secret = process.env.CLINT_SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLINT_SYNC_SECRET não configurado no servidor." }, { status: 500 });
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
