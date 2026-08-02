import { NextRequest, NextResponse } from "next/server";
import { renderSlide } from "@/lib/carousel/render";
import type { BrandKit, SlideContent, TemplateSpec } from "@/lib/carousel/types";

interface RenderRequestBody {
  /** Uma spec só, aplicada a todos os slides (uso simples: 1 layout repetido). */
  spec?: TemplateSpec;
  /** Uma spec por posição — specs[i] é usada pra slides[i]. Se specs.length for
   * menor que slides.length, a última spec do array é reaproveitada pras
   * posições restantes (comum quando só as primeiras lâminas têm layout
   * diferente, ex.: capa + conteúdo repetido). */
  specs?: TemplateSpec[];
  brand: BrandKit;
  slides: SlideContent[];
}

function isValidSpec(spec: unknown): spec is TemplateSpec {
  if (!spec || typeof spec !== "object") return false;
  const s = spec as Partial<TemplateSpec>;
  return (
    !!s.canvas &&
    typeof s.canvas.width === "number" &&
    typeof s.canvas.height === "number" &&
    typeof s.canvas.background === "string" &&
    Array.isArray(s.blocks)
  );
}

// Recebe a(s) spec(s) de template (extraída(s) previamente ou editada(s) à
// mão), a marca do cliente e o conteúdo de N slides, e devolve os PNGs
// gerados em base64. Uso interno — protegido por sessão via src/proxy.ts.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<RenderRequestBody>;

    if (!body.brand || !Array.isArray(body.slides) || body.slides.length === 0) {
      return NextResponse.json(
        { error: "Corpo inválido — envie { spec ou specs[], brand, slides[] }." },
        { status: 400 }
      );
    }

    const specsList = body.specs && body.specs.length > 0 ? body.specs : body.spec ? [body.spec] : [];

    if (specsList.length === 0) {
      return NextResponse.json(
        { error: "Envie 'spec' (um layout pra todos os slides) ou 'specs' (um layout por posição)." },
        { status: 400 }
      );
    }

    const invalidIndex = specsList.findIndex((s) => !isValidSpec(s));
    if (invalidIndex !== -1) {
      return NextResponse.json(
        {
          error: `A spec na posição ${invalidIndex} está incompleta — falta 'canvas' (width/height/background) ou 'blocks'. Reanalise a imagem de referência dessa lâmina ou corrija o JSON manualmente.`,
        },
        { status: 400 }
      );
    }

    const images = await Promise.all(
      body.slides.map(async (slide, i) => {
        const spec = specsList[Math.min(i, specsList.length - 1)];
        const buf = await renderSlide(spec, slide, body.brand as BrandKit);
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
