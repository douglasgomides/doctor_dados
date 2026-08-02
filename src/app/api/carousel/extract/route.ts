import { NextRequest, NextResponse } from "next/server";
import { extractTemplateSpec } from "@/lib/carousel/extract";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Recebe uma ou mais imagens de referência (multipart/form-data, campo
// "image" repetido — uma por lâmina do carrossel original) e devolve um
// array de especificações estruturais (uma por imagem, na mesma ordem), pra
// carrosséis onde cada posição (capa, conteúdo, CTA...) tem um layout
// diferente. Uso interno — protegido por sessão via src/proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll("image").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Envie ao menos uma imagem de referência no campo 'image'." },
        { status: 400 }
      );
    }
    if (files.length > 12) {
      return NextResponse.json(
        { error: "No máximo 12 imagens por vez." },
        { status: 400 }
      );
    }

    const invalid = files.find((f) => !ALLOWED_TYPES.has(f.type));
    if (invalid) {
      return NextResponse.json(
        { error: `Formato não suportado em "${invalid.name}". Use PNG, JPEG ou WebP.` },
        { status: 400 }
      );
    }

    const specs = await Promise.all(
      files.map(async (file) => {
        const bytes = Buffer.from(await file.arrayBuffer());
        const base64 = bytes.toString("base64");
        return extractTemplateSpec(base64, file.type as "image/png" | "image/jpeg" | "image/webp");
      })
    );

    return NextResponse.json({ specs });
  } catch (error) {
    console.error("Erro ao extrair modelo do carrossel:", error);
    const message = error instanceof Error ? error.message : "Erro ao extrair modelo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
