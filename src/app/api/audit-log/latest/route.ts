import { NextRequest, NextResponse } from "next/server";
import { buscarUltimaAuditoria, AuditEntityType } from "@/lib/audit-log";

// Autenticação + restrição a "master" impostas pelo middleware
// (src/proxy.ts) para o prefixo /api/audit-log. Usado nos modais de
// detalhe pra mostrar "Editado por Fulano em DD/MM" quando o registro foi
// mexido fora do fluxo de revisão (que já tem seu próprio rastro em
// reviewed_by_name).

const VALID_ENTITIES = new Set<AuditEntityType>([
  "roteiro",
  "reuniao",
  "comercial",
  "cliente",
  "usuario",
]);

export async function GET(req: NextRequest) {
  try {
    const entity = req.nextUrl.searchParams.get("entity") as AuditEntityType | null;
    const id = req.nextUrl.searchParams.get("id");

    if (!entity || !VALID_ENTITIES.has(entity) || !id) {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const entrada = await buscarUltimaAuditoria(entity, id);
    return NextResponse.json({ entrada });
  } catch (error) {
    console.error("Erro ao buscar auditoria:", error);
    return NextResponse.json({ error: "Erro ao buscar auditoria." }, { status: 500 });
  }
}
