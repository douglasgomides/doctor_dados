import { NextRequest, NextResponse } from "next/server";
import { buscarPendencias } from "@/lib/pendencias";

// Endpoint de leitura pra automação externa (n8n) buscar periodicamente
// "o que precisa de aviso agora" e disparar os WhatsApps pro responsável
// de cada cliente. Não é protegido por sessão de usuário (não fica sob o
// prefixo /api/dashboard no middleware) — é chamado por um serviço, não por
// um navegador logado — então usa um segredo compartilhado no header
// "x-automation-secret", no mesmo padrão de /api/db/init.
//
// A lógica de agregação em si vive em src/lib/pendencias.ts, compartilhada
// com /api/dashboard/pendencias (a mesma lista, mas disponível sob demanda
// dentro do próprio app pra quem está logado, em vez de só 1x/dia por
// WhatsApp).

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

    const alertas = await buscarPendencias();
    return NextResponse.json({ geradoEm: new Date().toISOString(), alertas });
  } catch (error) {
    console.error("Erro ao montar alertas de automação:", error);
    return NextResponse.json({ error: "Erro ao montar alertas de automação." }, { status: 500 });
  }
}
