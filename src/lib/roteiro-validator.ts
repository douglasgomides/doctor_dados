import { RoteiroFormat, RoteiroIssue, RoteiroValidation } from "@/types";

// Termos que violam a Resolução CFM 1.974/2011 (vedação a promessa de
// resultado, sensacionalismo, superlativos e captação por comparação).
// Detecção simples por palavra-chave — não substitui revisão humana, apenas
// pega os casos mais óbvios antes de chegarem ao médico.
const FORBIDDEN_TERMS = [
  "cura garantida",
  "resultado garantido",
  "garantia de resultado",
  "sem nenhum risco",
  "sem risco nenhum",
  "100% eficaz",
  "100% seguro",
  "nunca falha",
  "infalível",
  "melhor médico",
  "melhor médica",
  "o único que",
  "a única que",
  "número 1 em",
  "cura definitiva",
  "cura milagrosa",
  "milagre",
  "revolucionário",
];

const CTA_HINTS = [
  "agend",
  "clique",
  "clica",
  "chama",
  "manda mensagem",
  "chama no whats",
  "link na bio",
  "comenta",
  "arrasta",
  "compartilh",
  "salva esse",
  "marca um",
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function findForbiddenTerms(content: string): string[] {
  const lower = content.toLowerCase();
  return FORBIDDEN_TERMS.filter((term) => lower.includes(term));
}

function hasCtaHint(content: string): boolean {
  const lower = content.toLowerCase();
  return CTA_HINTS.some((hint) => lower.includes(hint));
}

function countMarkers(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? new Set(matches.map((m) => m.toLowerCase())).size : 0;
}

function validateReel(content: string, issues: RoteiroIssue[]): number {
  const hasGancho = /gancho\s*[:\-]/i.test(content);
  const hasCorpo = /corpo\s*[:\-]/i.test(content);
  const hasCta = /cta\s*[:\-]/i.test(content) || hasCtaHint(content);

  if (!hasGancho) {
    issues.push({
      severity: "erro",
      rule: "estrutura-reel-gancho",
      message: "Não identificamos um GANCHO explícito nos 3 primeiros segundos. Marque a seção com \"Gancho:\".",
    });
  }
  if (!hasCorpo) {
    issues.push({
      severity: "alerta",
      rule: "estrutura-reel-corpo",
      message: "Não identificamos a seção de CORPO marcada explicitamente. Marque com \"Corpo:\" para facilitar a revisão.",
    });
  }
  if (!hasCta) {
    issues.push({
      severity: "erro",
      rule: "estrutura-reel-cta",
      message: "Não identificamos uma chamada para ação (CTA) no final do roteiro.",
    });
  }

  const wordCount = countWords(content);
  const readingTimeSeconds = wordCount / 2.5;

  if (readingTimeSeconds > 95) {
    issues.push({
      severity: "alerta",
      rule: "duracao-reel",
      message: `Tempo de leitura estimado de ${Math.round(readingTimeSeconds)}s, acima do padrão de até 1min30 (90s). Considere cortar texto.`,
    });
  } else if (readingTimeSeconds < 12) {
    issues.push({
      severity: "alerta",
      rule: "duracao-reel-curta",
      message: `Tempo de leitura estimado de ${Math.round(readingTimeSeconds)}s, roteiro pode estar curto demais para entregar valor.`,
    });
  }

  return readingTimeSeconds;
}

function validateCarrossel(content: string, issues: RoteiroIssue[]) {
  const slideCount = countMarkers(content, /slide\s*\d+/gi) || countMarkers(content, /^\s*\d+[.)]/gm);

  if (slideCount === 0) {
    issues.push({
      severity: "erro",
      rule: "estrutura-carrossel-slides",
      message: "Não conseguimos identificar slides numerados (ex.: \"Slide 1\", \"Slide 2\"...). Numere os slides.",
    });
  } else if (slideCount < 4) {
    issues.push({
      severity: "alerta",
      rule: "quantidade-slides-baixa",
      message: `Apenas ${slideCount} slide(s) identificado(s). O padrão recomendado é de 5 a 10 slides.`,
    });
  } else if (slideCount > 12) {
    issues.push({
      severity: "alerta",
      rule: "quantidade-slides-alta",
      message: `${slideCount} slides identificados. Carrosséis muito longos tendem a perder retenção — considere reduzir.`,
    });
  }

  if (!hasCtaHint(content)) {
    issues.push({
      severity: "erro",
      rule: "estrutura-carrossel-cta",
      message: "Não identificamos uma chamada para ação (CTA) clara no carrossel.",
    });
  }
}

function validateStories(content: string, issues: RoteiroIssue[]) {
  const frameCount =
    countMarkers(content, /frame\s*\d+/gi) || countMarkers(content, /quadro\s*\d+/gi);

  if (frameCount === 0) {
    issues.push({
      severity: "erro",
      rule: "estrutura-stories-frames",
      message: "Não conseguimos identificar frames/quadros numerados (ex.: \"Frame 1\", \"Frame 2\"...). Numere os frames.",
    });
  } else if (frameCount < 5) {
    issues.push({
      severity: "alerta",
      rule: "quantidade-frames-baixa",
      message: `Apenas ${frameCount} frame(s) identificado(s). O padrão recomendado é de 7 a 10 frames.`,
    });
  } else if (frameCount > 12) {
    issues.push({
      severity: "alerta",
      rule: "quantidade-frames-alta",
      message: `${frameCount} frames identificados. Sequências muito longas tendem a perder o espectador antes do fim.`,
    });
  }

  if (!hasCtaHint(content)) {
    issues.push({
      severity: "alerta",
      rule: "estrutura-stories-cta",
      message: "Não identificamos uma chamada para ação clara na sequência de Stories.",
    });
  }
}

export function validateRoteiro(format: RoteiroFormat, content: string): RoteiroValidation {
  const issues: RoteiroIssue[] = [];
  const wordCount = countWords(content);
  let readingTimeSeconds: number | null = null;

  if (wordCount < 15) {
    issues.push({
      severity: "erro",
      rule: "conteudo-insuficiente",
      message: "O roteiro está curto demais para avaliar a estrutura (menos de 15 palavras).",
    });
  } else {
    if (format === "reel") {
      readingTimeSeconds = validateReel(content, issues);
    } else if (format === "carrossel") {
      validateCarrossel(content, issues);
    } else {
      validateStories(content, issues);
    }
  }

  const forbiddenFound = findForbiddenTerms(content);
  for (const term of forbiddenFound) {
    issues.push({
      severity: "erro",
      rule: "compliance-cfm",
      message: `Termo "${term}" pode violar as normas do CFM (promessa de resultado, superlativo ou comparação). Reescreva esse trecho.`,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "erro").length;
  const warningCount = issues.filter((i) => i.severity === "alerta").length;
  const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10);
  const status: RoteiroValidation["status"] = errorCount > 0 ? "ajustar" : "aprovado";

  return { status, score, issues, wordCount, readingTimeSeconds };
}
