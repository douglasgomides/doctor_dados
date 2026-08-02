import Anthropic from "@anthropic-ai/sdk";
import type { TemplateSpec } from "./types";

// Schema JSON que força o modelo a devolver uma TemplateSpec válida (ver
// ./types.ts) via tool use — evita ter que parsear texto livre.
const BLOCK_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    role: {
      type: "string",
      enum: [
        "avatar",
        "handle",
        "title",
        "subtitle",
        "photo",
        "card-bg",
        "card-header-bg",
        "card-label",
        "card-value",
        "card-bullet",
        "footer-label",
        "footer-text",
        "decoration",
      ],
    },
    group: {
      type: "string",
      description:
        "Obrigatório para blocos de card (card-bg, card-header-bg, card-label, card-value, card-bullet): use o mesmo group para todos os blocos do MESMO card/coluna (ex.: 'low', 'normal', 'high', ou 'card1', 'card2'...).",
    },
    type: { type: "string", enum: ["rect", "text", "image", "icon"] },
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
    radius: { type: "number" },
    fill: { type: "string", description: "cor hex, ex: #a6362b" },
    accentSlot: {
      type: ["string", "null"],
      enum: ["primary", "secondary", "tertiary", null],
      description:
        "Marque como 'primary' APENAS o elemento decorativo que representa a cor de marca (ex.: um traço/linha de destaque). NÃO marque cores funcionais/semânticas (ex.: vermelho=alerta, verde=ok, laranja=atenção em cards comparativos) — essas devem ficar accentSlot: null pra preservar o significado.",
    },
    text: { type: "string" },
    fontSize: { type: "number" },
    fontWeight: { type: "number", enum: [400, 700] },
    color: { type: "string" },
    align: { type: "string", enum: ["left", "center"] },
    fadeLeft: { type: "number" },
    fadeBottom: { type: "number" },
    cx: { type: "number" },
    cy: { type: "number" },
    r: { type: "number" },
    kind: { type: "string", enum: ["check", "alert", "dot"] },
    bg: { type: "string" },
    fg: { type: "string" },
  },
  required: ["id", "role", "type"],
};

const TEMPLATE_SPEC_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    canvas: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        background: { type: "string" },
      },
      required: ["width", "height", "background"],
    },
    blocks: { type: "array", items: BLOCK_SCHEMA },
  },
  required: ["name", "canvas", "blocks"],
};

const EXTRACTION_PROMPT = `Você vai analisar a imagem de referência de um slide de carrossel/post de Instagram e
descrever sua estrutura visual como uma lista ordenada de blocos (retângulo, texto, imagem, ícone),
usando a ferramenta "emit_template_spec".

Regras importantes:
- Canvas: use exatamente 1080x1350 (proporção 4:5, padrão feed do Instagram), mesmo que a imagem
  de referência tenha outra resolução — escale as coordenadas proporcionalmente.
- Ordem dos blocos = ordem de desenho (do fundo pra frente). Coloque fundo/foto primeiro, texto por
  último.
- Se o design tiver "cards" repetidos lado a lado (ex.: 3 colunas comparando baixo/normal/alto),
  marque cada card com um "group" compartilhado entre seus blocos (card-bg, card-header-bg,
  card-label, card-value, card-bullet) — um group por coluna.
- O bloco "card-bullet" representa APENAS a posição do PRIMEIRO item da lista — não repita um bloco
  por item, o motor de renderização distribui o conteúdo novo automaticamente.
- accentSlot: marque como "primary" só o elemento que representa a cor de marca/identidade (ex. uma
  linha de destaque, um botão). NUNCA marque cores com significado funcional (vermelho=alerta,
  verde=ok, laranja=atenção) — essas ficam com accentSlot null e mantêm a cor fixa extraída.
- Extraia o texto real visível como "text" de cada bloco de texto (será usado como fallback/exemplo).
- fontWeight: 700 para negrito/bold, 400 para regular.
- Blocos "image" com role "photo" devem ter fadeLeft/fadeBottom se a foto se mistura com o fundo
  numa das bordas (senão, 0).
- Blocos "image" com role "avatar" devem ser quadrados (w === h) — o motor recorta em círculo.

Analise a imagem com cuidado e emita a especificação completa.`;

export async function extractTemplateSpec(
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp"
): Promise<TemplateSpec> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Adicione essa variável de ambiente (obtida em console.anthropic.com) pra habilitar a extração automática de modelos a partir de imagens."
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    tools: [
      {
        name: "emit_template_spec",
        description: "Emite a especificação estrutural (blocos) do template visual analisado.",
        input_schema: TEMPLATE_SPEC_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "emit_template_spec" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("O modelo não retornou uma especificação estruturada. Tente novamente.");
  }

  return toolUse.input as TemplateSpec;
}
