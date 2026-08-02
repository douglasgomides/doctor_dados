// Spec escrita à mão reproduzindo o template "3 colunas" (o mesmo que
// desenhamos no piloto Python) — serve para validar o motor TypeScript
// (render.ts) de ponta a ponta, como se essa spec tivesse vindo da extração
// por IA a partir da imagem de referência.
const W = 1080, H = 1350;
const MARGIN = 56;
const RED = "#a6362b", RED_TEXT = "#962d23";
const GREEN = "#2f4a34", GREEN_TEXT = "#284433";
const ORANGE = "#c46a2b", ORANGE_TEXT = "#b96226";
const cardW = (W - 2 * MARGIN - 2 * 22) / 3;
const cardsY0 = 410, cardsY1 = 1140;

function card(group, x0, headColor, textColor, iconKind) {
  return [
    { id: `${group}-bg`, type: "rect", role: "card-bg", group, x: x0, y: cardsY0, w: cardW, h: cardsY1 - cardsY0, radius: 22, fill: "#ffffff" },
    { id: `${group}-head`, type: "rect", role: "card-header-bg", group, x: x0, y: cardsY0, w: cardW, h: 118, radius: 22, fill: headColor },
    { id: `${group}-icon`, type: "icon", role: "decoration", group, cx: x0 + 38, cy: cardsY0 + 59, r: 17, kind: iconKind, bg: headColor, fg: "#ffffff" },
    { id: `${group}-label`, type: "text", role: "card-label", group, x: x0 + 62, y: cardsY0 + 34, w: cardW - 78, text: "LABEL", fontSize: 18, fontWeight: 700, color: "#ffffff", align: "center" },
    { id: `${group}-value`, type: "text", role: "card-value", group, x: x0 + 18, y: cardsY0 + 118 + 40, w: cardW - 36, text: "valor", fontSize: 30, fontWeight: 700, color: textColor, align: "center" },
    { id: `${group}-bullets`, type: "text", role: "card-bullet", group, x: x0 + 22, y: cardsY0 + 118 + 90, w: cardW - 44, text: "bullet", fontSize: 17, fontWeight: 400, color: headColor },
  ];
}

export const spec = {
  name: "3-colunas-comparativo",
  canvas: { width: W, height: H, background: "#f3ede3" },
  blocks: [
    { id: "avatar", type: "image", role: "avatar", x: MARGIN, y: 48, w: 68, h: 68 },
    { id: "handle", type: "text", role: "handle", x: MARGIN + 82, y: 88, w: 300, text: "@handle", fontSize: 24, fontWeight: 700, color: "#1e1a16" },
    { id: "title", type: "text", role: "title", x: MARGIN, y: 242, w: 600, text: "Título", fontSize: 66, fontWeight: 700, color: "#1e1a16" },
    { id: "subtitle", type: "text", role: "subtitle", x: MARGIN, y: 358, w: 600, text: "subtítulo", fontSize: 46, fontWeight: 400, color: "#3c362e" },
    { id: "underline", type: "rect", role: "decoration", x: MARGIN, y: 386, w: 300, h: 6, fill: "#c49527", accentSlot: "primary" },
    { id: "photo", type: "image", role: "photo", x: 620, y: 0, w: W - 620, h: 570, radius: 0, fadeLeft: 240, fadeBottom: 100 },
    ...card("low", MARGIN, RED, RED_TEXT, "alert"),
    ...card("normal", MARGIN + cardW + 22, GREEN, GREEN_TEXT, "check"),
    ...card("high", MARGIN + 2 * (cardW + 22), ORANGE, ORANGE_TEXT, "alert"),
    { id: "footer-label", type: "text", role: "footer-label", x: MARGIN, y: cardsY1 + 46, w: 400, text: "IMPORTANTE", fontSize: 22, fontWeight: 700, color: "#1e1a16" },
    { id: "footer-text", type: "text", role: "footer-text", x: MARGIN, y: cardsY1 + 80, w: W - 2 * MARGIN, text: "texto", fontSize: 20, fontWeight: 400, color: "#5a5248" },
  ],
};
