import { NextRequest, NextResponse } from "next/server";
import { fetchSheetData } from "@/lib/google-sheets";

// Antes, o navegador buscava a planilha inteira diretamente (client-side),
// e a restrição "cliente só vê a própria conta" era só um filtro de UI —
// qualquer usuário client conseguia ver os dados de todas as contas de
// anúncio abrindo o DevTools. Agora a planilha é buscada no servidor e
// filtrada por conta antes de responder.
export async function GET(req: NextRequest) {
  try {
    const role = req.headers.get("x-session-role");
    const accountName = req.headers.get("x-session-account-name");

    const data = await fetchSheetData();

    const filtered =
      role === "master" || !accountName
        ? data
        : data.filter((row) => row.contaDeAnuncio === accountName);

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error("Erro ao buscar dados da planilha:", error);
    return NextResponse.json(
      { error: "Erro ao buscar dados da planilha." },
      { status: 500 }
    );
  }
}
