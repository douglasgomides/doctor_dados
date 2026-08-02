import { NextRequest, NextResponse } from "next/server";
import { renderSlide } from "@/lib/carousel/render";
import type { BrandKit, SlideContent, TemplateSpec } from "@/lib/carousel/types";

interface RenderRequestBody {
  spec: TemplateSpec;
  brand: BrandKit;
  slides: SlideContent[];
}

// Recebe a spec de um template (extraída previamente ou editada à mão), a
// marca do cliente e o conteúdo de N slides, e devolve os PNGs gerados em
// base64. Uso interno — protegido por sessão via src/proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<RenderRequestBody>;

    if (!body.spec || !body.brand || !Array.isArray(body.slides) || body.slides.length === 0) {
      return NextResponse.json(
        { error: "Corpo inválido — envie { spec, brand, slides[] }." },
        { status: 400 }
      );
    }

    const images = await Promise.all(
      body.slides.map(async (slide) => {
        const buf = await renderSlide(body.spec as TemplateSpec, slide, body.brand as BrandKit);
        return buf.toString("base64");
      })
    );

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Erro ao renderizar carrossel:", error);
    const message = error instanceof Error ? error.message : "Erro ao renderizar carrossel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
