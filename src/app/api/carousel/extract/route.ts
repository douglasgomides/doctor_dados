import { NextRequest, NextResponse } from "next/server";
import { extractTemplateSpec } from "@/lib/carousel/extract";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Recebe a imagem de referência (multipart/form-data, campo "image") e devolve
// a especificação estrutural do template (TemplateSpec) extraída por IA com
// visão. Uso interno — protegido por sessão via src/proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Envie a imagem de referência no campo 'image'." },
        { status: 400 }
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Formato de imagem não suportado. Use PNG, JPEG ou WebP." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const spec = await extractTemplateSpec(
      base64,
      file.type as "image/png" | "image/jpeg" | "image/webp"
    );

    return NextResponse.json({ spec });
  } catch (error) {
    console.error("Erro ao extrair modelo do carrossel:", error);
    const message = error instanceof Error ? error.message : "Erro ao extrair modelo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
