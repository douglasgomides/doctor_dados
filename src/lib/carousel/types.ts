// Esquema genérico de "template de carrossel/post": qualquer arte de referência
// (enviada pelo time) é descrita como uma lista ordenada de blocos (retângulo,
// texto, imagem, ícone). A extração (extract.ts, via IA com visão) lê a imagem
// de referência e preenche esse esquema; o renderizador (render.ts) desenha os
// blocos com o conteúdo e a marca novos, sem depender do layout original ser
// hardcoded no código — por isso um único motor serve para qualquer modelo.

export type BlockRole =
  | "avatar" // foto circular do médico (badge do canto superior)
  | "handle" // @usuario ao lado do avatar
  | "title" // título grande do slide
  | "subtitle" // linha menor abaixo do título
  | "photo" // foto principal (modelo/paciente) que sangra pela lateral
  | "card-bg"
  | "card-header-bg"
  | "card-label"
  | "card-value"
  | "card-bullet"
  | "footer-label"
  | "footer-text"
  | "decoration";

interface BaseBlock {
  id: string;
  role: BlockRole;
  /** Agrupa blocos do mesmo "cartão" (ex.: os 3 cards baixo/normal/alto) para
   * que o conteúdo novo (slides[].cards[]) saiba qual grupo preencher. */
  group?: string;
}

export interface RectBlock extends BaseBlock {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  fill: string; // hex, pode ser remapeada pela marca (accentSlot)
  accentSlot?: "primary" | "secondary" | "tertiary" | null;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  x: number;
  y: number;
  w: number;
  text: string; // texto extraído do original; pode ser sobrescrito por content
  fontSize: number;
  fontWeight: 400 | 700;
  color: string;
  accentSlot?: "primary" | "secondary" | "tertiary" | null;
  align?: "left" | "center";
  lineHeight?: number;
  maxLines?: number;
}

export interface ImageBlock extends BaseBlock {
  type: "image";
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  fadeLeft?: number;
  fadeBottom?: number;
}

export interface IconBlock extends BaseBlock {
  type: "icon";
  cx: number;
  cy: number;
  r: number;
  kind: "check" | "alert" | "dot";
  bg: string;
  fg: string;
  accentSlot?: "primary" | "secondary" | "tertiary" | null;
}

export type Block = RectBlock | TextBlock | ImageBlock | IconBlock;

export interface TemplateSpec {
  name: string;
  canvas: { width: number; height: number; background: string };
  blocks: Block[];
}

export interface BrandKit {
  name: string; // "Dr. Keylon Lucarelli"
  handle: string; // "@Drkeylonlucarelli"
  primary: string; // hex
  secondary?: string;
  tertiary?: string;
  avatarPhotoBase64?: string; // data URI ou base64 puro
  mainPhotoBase64?: string;
}

/** Conteúdo novo de um card (ex.: coluna "baixa/normal/alta"). Cada card do
 * spec original (identificado por `group`) recebe um objeto destes. */
export interface CardContent {
  group: string;
  label?: string;
  value?: string;
  bullets?: string[];
}

export interface SlideContent {
  title: string;
  subtitle?: string;
  cards?: CardContent[];
  footerLabel?: string;
  footerText?: string;
}
