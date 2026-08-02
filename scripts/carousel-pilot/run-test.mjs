import { renderSlide } from "../../src/lib/carousel/render.ts";
import { spec } from "./test-spec.mjs";
import fs from "node:fs";

function b64(path) {
  return fs.readFileSync(path).toString("base64");
}

const brandKeylon = {
  name: "Dr. Keylon Lucarelli",
  handle: "@Drkeylonlucarelli",
  primary: "#c49527",
  avatarPhotoBase64: b64("/tmp/claude-0/-home-user-doctor-dados/274323ba-04ce-570b-9717-9ad571f7aba5/scratchpad/carrossel_keylon/foto_perfil_keylon.jpg"),
  mainPhotoBase64: b64("/tmp/claude-0/-home-user-doctor-dados/274323ba-04ce-570b-9717-9ad571f7aba5/scratchpad/carrossel_keylon/foto_keylon_modelo.png"),
};

const contentTSH = {
  title: "TSH",
  subtitle: "na mulher",
  cards: [
    { group: "low", label: "BAIXA /\nATENÇÃO", value: "< 0,4 mUI/L", bullets: ["Taquicardia e ansiedade", "Insônia e tremores", "Perda de peso não intencional", "Palpitações frequentes", "Intolerância ao calor", "Irritabilidade aumentada", "Sudorese excessiva"] },
    { group: "normal", label: "NORMAL /\nFAIXA FISIOLÓGICA", value: "0,4 – 4,0 mUI/L", bullets: ["Metabolismo equilibrado", "Energia estável no dia a dia", "Ciclo menstrual regular", "Sono de boa qualidade", "Humor estável", "Peso corporal estável", "Boa tolerância ao exercício"] },
    { group: "high", label: "ALTA /\nATENÇÃO", value: "> 4,0 mUI/L", bullets: ["Fadiga e ganho de peso", "Queda de cabelo", "Intestino preso e frio constante", "Pele seca", "Unhas fracas", "Raciocínio mais lento", "Retenção de líquido"] },
  ],
  footerLabel: "IMPORTANTE",
  footerText: "TSH isolado não fecha diagnóstico — interpretar sempre com T4 livre e sintomas clínicos.",
};

// Testa com uma marca DIFERENTE (cor azul, sem trocar o restante do motor)
// pra provar que a adaptação de marca funciona sem tocar no layout.
const brandOutraMarca = {
  ...brandKeylon,
  name: "Dra. Exemplo",
  handle: "@draexemplo",
  primary: "#1b6fb8",
};

const out1 = await renderSlide(spec, contentTSH, brandKeylon);
fs.writeFileSync("./out-keylon-tsh.png", out1);
console.log("gerado out-keylon-tsh.png", out1.length, "bytes");

const out2 = await renderSlide(spec, contentTSH, brandOutraMarca);
fs.writeFileSync("./out-outramarca-tsh.png", out2);
console.log("gerado out-outramarca-tsh.png", out2.length, "bytes");

// Sem foto de marca (fallback) — garante que não quebra quando falta imagem.
const out3 = await renderSlide(spec, contentTSH, { ...brandKeylon, avatarPhotoBase64: undefined, mainPhotoBase64: undefined });
fs.writeFileSync("./out-sem-foto.png", out3);
console.log("gerado out-sem-foto.png", out3.length, "bytes");
