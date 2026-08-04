import { NextResponse } from "next/server";
import { buscarPendencias } from "@/lib/pendencias";

// Autenticação + restrição a "master" impostas pelo middleware (src/proxy.ts)
// pra todo o prefixo /api/dashboard. Mesma lógica de agregação do alerta
// diário de WhatsApp (src/lib/pendencias.ts), mas disponível sob demanda —
// não precisa esperar as 9h pra ver o que está pendente.

export async function GET() {
  try {
    const pendencias = await buscarPendencias();
    return NextResponse.json({ geradoEm: new Date().toISOString(), pendencias });
  } catch (error) {
    console.error("Erro ao montar central de pendências:", error);
    return NextResponse.json({ error: "Erro ao montar central de pendências." }, { status: 500 });
  }
}
