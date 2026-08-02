import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import sharp from "sharp";
import type {
  BrandKit,
  CardContent,
  ImageBlock,
  RectBlock,
  SlideContent,
  TemplateSpec,
  TextBlock,
} from "./types";

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  // Usa as fontes já presentes no sistema (DejaVu, vem com a maioria das
  // imagens Linux/Alpine com fontconfig). Se não existirem, o canvas cai
  // para a fonte sans padrão do sistema — não quebra o render.
  const candidates = [
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "AppSans"],
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "AppSans-Bold"],
  ] as const;
  for (const [file, family] of candidates) {
    try {
      GlobalFonts.registerFromPath(file, family);
    } catch {
      // segue sem essa fonte específica
    }
  }
  fontsRegistered = true;
}

function fontFamily(weight: 400 | 700): string {
  return weight === 700 ? "AppSans-Bold, sans-serif" : "AppSans, sans-serif";
}

function resolveColor(
  hex: string,
  accentSlot: RectBlock["accentSlot"] | undefined,
  brand: BrandKit
): string {
  if (!accentSlot) return hex;
  if (accentSlot === "primary") return brand.primary || hex;
  if (accentSlot === "secondary") return brand.secondary || brand.primary || hex;
  if (accentSlot === "tertiary") return brand.tertiary || brand.primary || hex;
  return hex;
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !cur) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawMultiline(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: "left" | "center" = "left",
  boxWidth = maxWidth
): number {
  const lines = wrapText(ctx, text, maxWidth);
  let cy = y;
  for (const line of lines) {
    if (align === "center") {
      const w = ctx.measureText(line).width;
      ctx.fillText(line, x + (boxWidth - w) / 2, cy);
    } else {
      ctx.fillText(line, x, cy);
    }
    cy += lineHeight;
  }
  return cy;
}

/**
 * Fotos vindas de fora (export do ChatGPT, celular, WhatsApp etc.) às vezes
 * têm chunks/metadados que o decodificador do @napi-rs/canvas rejeita
 * silenciosamente como "Invalid SVG image". Recodificar com sharp antes
 * normaliza qualquer PNG/JPEG/WebP de entrada para um PNG limpo.
 */
async function normalizeImageBuffer(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf).png().toBuffer();
  } catch {
    // se nem o sharp conseguir decodificar, deixa o buffer original seguir
    // e falhar de forma explícita no loadImage
    return buf;
  }
}

async function loadBrandImage(dataUriOrBase64?: string) {
  if (!dataUriOrBase64) return null;
  const base64 = dataUriOrBase64.includes(",")
    ? dataUriOrBase64.split(",")[1]
    : dataUriOrBase64;
  const raw = Buffer.from(base64, "base64");
  const normalized = await normalizeImageBuffer(raw);
  return loadImage(normalized);
}

function drawCircleClipped(
  ctx: SKRSContext2D,
  img: Awaited<ReturnType<typeof loadImage>>,
  cx: number,
  cy: number,
  r: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawCoverImage(
  ctx: SKRSContext2D,
  img: Awaited<ReturnType<typeof loadImage>>,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x - (dw - w) / 2;
  const dy = y; // ancorado no topo, como no template original
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawEdgeFade(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  background: string,
  fadeLeft: number,
  fadeBottom: number
) {
  if (fadeLeft > 0) {
    const grad = ctx.createLinearGradient(x, 0, x + fadeLeft, 0);
    grad.addColorStop(0, background);
    grad.addColorStop(1, hexToRgba(background, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, fadeLeft, h);
  }
  if (fadeBottom > 0) {
    const grad = ctx.createLinearGradient(0, y + h - fadeBottom, 0, y + h);
    grad.addColorStop(0, hexToRgba(background, 0));
    grad.addColorStop(1, background);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y + h - fadeBottom, w, fadeBottom);
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundRectPath(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function findCard(content: SlideContent | undefined, group: string | undefined): CardContent | undefined {
  if (!content?.cards || !group) return undefined;
  return content.cards.find((c) => c.group === group);
}

export async function renderSlide(
  spec: TemplateSpec,
  content: SlideContent,
  brand: BrandKit
): Promise<Buffer> {
  if (!spec?.canvas || typeof spec.canvas.width !== "number" || typeof spec.canvas.height !== "number") {
    throw new Error(
      "Spec de template inválida: falta 'canvas' com width/height/background. Reanalise a imagem de referência ou corrija o JSON."
    );
  }
  if (!Array.isArray(spec.blocks)) {
    throw new Error("Spec de template inválida: falta o array 'blocks'.");
  }
  ensureFonts();
  const { width, height, background } = spec.canvas;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const avatarImg = await loadBrandImage(brand.avatarPhotoBase64);
  const mainImg = await loadBrandImage(brand.mainPhotoBase64);

  // Pré-calcula, por grupo, o limite inferior do card (para distribuir os
  // bullets uniformemente até o fundo, igual ao motor usado no piloto Python).
  const cardBottomByGroup = new Map<string, number>();
  for (const b of spec.blocks) {
    if (b.type === "rect" && b.role === "card-bg" && b.group) {
      cardBottomByGroup.set(b.group, b.y + b.h - 24);
    }
  }

  for (const block of spec.blocks) {
    if (block.type === "rect") {
      drawRect(ctx, block, brand);
    } else if (block.type === "icon") {
      drawIcon(ctx, block, brand);
    } else if (block.type === "image") {
      await drawImageBlock(ctx, block, background, avatarImg, mainImg);
    } else if (block.type === "text") {
      drawTextBlock(ctx, block, content, brand, cardBottomByGroup);
    }
  }

  return canvas.toBuffer("image/png");
}

function drawRect(ctx: SKRSContext2D, block: RectBlock, brand: BrandKit) {
  const fill = resolveColor(block.fill, block.accentSlot, brand);
  ctx.fillStyle = fill;
  if (block.radius) {
    roundRectPath(ctx, block.x, block.y, block.w, block.h, block.radius);
    ctx.fill();
  } else {
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
}

function drawIcon(ctx: SKRSContext2D, block: import("./types").IconBlock, brand: BrandKit) {
  const bg = resolveColor(block.bg, block.accentSlot, brand);
  ctx.fillStyle = block.kind === "dot" ? bg : "#ffffff";
  ctx.beginPath();
  ctx.arc(block.cx, block.cy, block.r, 0, Math.PI * 2);
  ctx.fill();
  if (block.kind === "check") {
    ctx.strokeStyle = bg;
    ctx.lineWidth = Math.max(2, block.r * 0.22);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(block.cx - block.r * 0.45, block.cy);
    ctx.lineTo(block.cx - block.r * 0.1, block.cy + block.r * 0.4);
    ctx.lineTo(block.cx + block.r * 0.5, block.cy - block.r * 0.45);
    ctx.stroke();
  } else if (block.kind === "alert") {
    ctx.fillStyle = bg;
    ctx.font = `bold ${Math.round(block.r * 1.2)}px ${fontFamily(700)}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", block.cx, block.cy + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  } else if (block.kind === "dot") {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(block.cx, block.cy, block.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

async function drawImageBlock(
  ctx: SKRSContext2D,
  block: ImageBlock,
  background: string,
  avatarImg: Awaited<ReturnType<typeof loadImage>> | null,
  mainImg: Awaited<ReturnType<typeof loadImage>> | null
) {
  if (block.role === "avatar") {
    const r = block.w / 2;
    if (avatarImg) {
      drawCircleClipped(ctx, avatarImg, block.x + r, block.y + r, r);
    } else {
      ctx.fillStyle = "#1e1a16";
      ctx.beginPath();
      ctx.arc(block.x + r, block.y + r, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (block.role === "photo") {
    if (mainImg) {
      ctx.save();
      roundRectPath(ctx, block.x, block.y, block.w, block.h, block.radius || 0);
      ctx.clip();
      drawCoverImage(ctx, mainImg, block.x, block.y, block.w, block.h);
      ctx.restore();
      drawEdgeFade(
        ctx,
        block.x,
        block.y,
        block.w,
        block.h,
        background,
        block.fadeLeft || 0,
        block.fadeBottom || 0
      );
    } else {
      ctx.fillStyle = "#d9d0c2";
      roundRectPath(ctx, block.x, block.y, block.w, block.h, block.radius || 0);
      ctx.fill();
      ctx.fillStyle = "#8a7d68";
      ctx.font = `bold 16px ${fontFamily(700)}`;
      ctx.fillText("sem foto — envie a foto da marca", block.x + 16, block.y + block.h - 20);
    }
  }
}

function drawTextBlock(
  ctx: SKRSContext2D,
  block: TextBlock,
  content: SlideContent,
  brand: BrandKit,
  cardBottomByGroup: Map<string, number>
) {
  const color = resolveColor(block.color, block.accentSlot, brand);
  ctx.fillStyle = color;
  ctx.font = `${block.fontWeight === 700 ? "bold " : ""}${block.fontSize}px ${fontFamily(block.fontWeight)}`;

  const card = findCard(content, block.group);

  if (block.role === "handle") {
    ctx.fillText(brand.handle, block.x, block.y);
    return;
  }
  if (block.role === "title") {
    drawMultiline(ctx, content.title, block.x, block.y, block.w, block.fontSize + 6);
    return;
  }
  if (block.role === "subtitle") {
    ctx.fillText(content.subtitle || block.text, block.x, block.y);
    return;
  }
  if (block.role === "footer-label") {
    ctx.fillText(content.footerLabel || block.text, block.x, block.y);
    return;
  }
  if (block.role === "footer-text") {
    drawMultiline(ctx, content.footerText || block.text, block.x, block.y, block.w, block.fontSize + 6);
    return;
  }
  if (block.role === "card-label") {
    const text = card?.label ?? block.text;
    drawMultiline(
      ctx,
      text,
      block.x,
      block.y,
      block.w,
      block.fontSize + 5,
      block.align === "center" ? "center" : "left",
      block.w
    );
    return;
  }
  if (block.role === "card-value") {
    const text = card?.value ?? block.text;
    drawMultiline(
      ctx,
      text,
      block.x,
      block.y,
      block.w,
      block.fontSize + 4,
      block.align === "center" ? "center" : "left",
      block.w
    );
    return;
  }
  if (block.role === "card-bullet") {
    const bullets = card?.bullets ?? [block.text];
    const lineHeight = block.fontSize + 5;
    const bottomLimit = block.group ? cardBottomByGroup.get(block.group) ?? Infinity : Infinity;

    // Mede a altura "natural" (espaçamento mínimo) pra saber quanto sobra
    // pra distribuir uniformemente até o fundo do card — mesma lógica do
    // piloto em Python, agora em TS.
    const baseGap = 10;
    let naturalHeight = 0;
    for (const b of bullets) {
      const lines = wrapText(ctx, b, block.w - 18);
      naturalHeight += lines.length * lineHeight + baseGap;
    }
    const available = Math.max(0, bottomLimit - block.y);
    const extraPerBullet =
      bullets.length && naturalHeight < available
        ? Math.min((available - naturalHeight) / bullets.length, 42)
        : 0;
    const gap = baseGap + extraPerBullet;

    let y = block.y;
    for (const b of bullets) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(block.x + 4, y - block.fontSize * 0.35, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2d2822";
      y = drawMultiline(ctx, b, block.x + 18, y, block.w - 18, lineHeight);
      y += gap;
      if (y > bottomLimit + 40) break;
    }
    return;
  }

  // fallback genérico: desenha o texto extraído como está
  drawMultiline(ctx, block.text, block.x, block.y, block.w, block.fontSize + 4);
}
