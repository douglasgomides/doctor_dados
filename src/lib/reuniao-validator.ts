import { ReuniaoIssue, ReuniaoTipo, ReuniaoValidation } from "@/types";

// Heurísticas baseadas em palavras-chave sobre a transcrição do Meet. Não
// substitui julgamento humano — pega os casos mais óbvios de reunião
// incompleta antes de ficarem invisíveis no meio de dezenas de mentorias.

const PROXIMA_REUNIAO_RE = /pr[oó]xima\s+reuni[aã]o/i;
const DATA_HINT_RE =
  /\d{1,2}\/\d{1,2}(\/\d{2,4})?|dia\s+\d{1,2}|(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)([- ]feira)?|daqui\s+a\s+\d+\s*(dias?|semanas?)|(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i;

const ACAO_MEDICO_RE =
  /\b(voc[eê]|dr\.?|dra\.?)\s+(vai|precisa|fica\s+de|vai\s+ficar\s+de|combinou\s+de)\b|fica(mos)?\s+combinad[oa]s?\s+(de|que)|sua\s+parte\b/i;

const ENTREGA_CONSULTORIA_RE =
  /\b(a\s+)?(equipe|consultoria|a\s+gente|n[oó]s)\s+(vai|vamos|fica(mos)?\s+de)\s+(mandar|enviar|entregar|preparar|montar|fazer)\b|\bvou\s+(te\s+)?(mandar|enviar|entregar)\b/i;

const NUMERO_RE =
  /\d+([.,]\d+)?\s*%|R\$\s?\d|\bseguidores?\b|\balcance\b|\bengajamento\b|\bcliques?\b|\bleads?\b|\bconsultas?\b|\bimpress(ões|oes)\b/gi;

const ACAO_DECISAO_RE =
  /\b(ent[aã]o|por\s+isso|vamos|precisamos|decidimos|ajustar|mudar|melhorar|estrat[ée]gia|a[cç][aã]o|pr[oó]ximo\s+passo|significa\s+que)\b/i;

const SPEAKER_LINE_RE = /^([A-ZÀ-Ý][\wÀ-ÿ' ]{1,40}?):\s*(.+)$/gm;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function findSentence(content: string, matchIndex: number): string {
  const start = content.lastIndexOf("\n", matchIndex) + 1;
  let end = content.indexOf("\n", matchIndex);
  if (end === -1) end = content.length;
  return content.slice(start, end).trim().slice(0, 220);
}

function checkComprometimentos(content: string, issues: ReuniaoIssue[], agenda: string[]) {
  const proximaMatch = PROXIMA_REUNIAO_RE.exec(content);
  if (!proximaMatch) {
    issues.push({
      severity: "erro",
      rule: "comprometimento-data",
      message: "Não identificamos menção a uma próxima reunião marcada.",
    });
  } else {
    const windowStart = Math.max(0, proximaMatch.index - 150);
    const windowEnd = Math.min(content.length, proximaMatch.index + 150);
    const window = content.slice(windowStart, windowEnd);
    if (!DATA_HINT_RE.test(window)) {
      issues.push({
        severity: "erro",
        rule: "comprometimento-data",
        message: "A próxima reunião foi mencionada, mas sem data ou dia definido claramente por perto.",
      });
    } else {
      agenda.push(`Confirmar: ${findSentence(content, proximaMatch.index)}`);
    }
  }

  const acaoMatch = ACAO_MEDICO_RE.exec(content);
  if (!acaoMatch) {
    issues.push({
      severity: "erro",
      rule: "comprometimento-medico",
      message: "Não identificamos uma ação combinada claramente para o médico até a próxima reunião.",
    });
  } else {
    agenda.push(`Cobrar do médico: ${findSentence(content, acaoMatch.index)}`);
  }

  const entregaMatch = ENTREGA_CONSULTORIA_RE.exec(content);
  if (!entregaMatch) {
    issues.push({
      severity: "erro",
      rule: "comprometimento-consultoria",
      message: "Não identificamos uma entrega da consultoria claramente combinada até a próxima reunião.",
    });
  } else {
    agenda.push(`Entregar antes da próxima: ${findSentence(content, entregaMatch.index)}`);
  }
}

function checkFalaDesequilibrada(content: string, issues: ReuniaoIssue[]) {
  const wordsPerSpeaker = new Map<string, number>();
  let match: RegExpExecArray | null;
  SPEAKER_LINE_RE.lastIndex = 0;
  while ((match = SPEAKER_LINE_RE.exec(content)) !== null) {
    const speaker = match[1].trim().toLowerCase();
    const words = countWords(match[2]);
    wordsPerSpeaker.set(speaker, (wordsPerSpeaker.get(speaker) || 0) + words);
  }

  if (wordsPerSpeaker.size < 2) return;

  const total = [...wordsPerSpeaker.values()].reduce((a, b) => a + b, 0);
  if (total < 50) return;

  const [topSpeaker, topWords] = [...wordsPerSpeaker.entries()].sort((a, b) => b[1] - a[1])[0];
  const share = topWords / total;

  if (share > 0.75) {
    issues.push({
      severity: "alerta",
      rule: "fala-desequilibrada",
      message: `"${topSpeaker}" concentrou ~${Math.round(share * 100)}% da conversa — favoreça mais espaço de fala para o médico.`,
    });
  }
}

function checkNumerosENegocio(content: string, issues: ReuniaoIssue[]) {
  const matches = [...content.matchAll(NUMERO_RE)];
  if (matches.length === 0) {
    issues.push({
      severity: "alerta",
      rule: "sem-performance",
      message: "Não identificamos nenhuma menção a número ou performance na reunião.",
    });
    return;
  }

  const hasCruzamento = matches.some((m) => {
    const idx = m.index ?? 0;
    const windowStart = Math.max(0, idx - 250);
    const windowEnd = Math.min(content.length, idx + 250);
    return ACAO_DECISAO_RE.test(content.slice(windowStart, windowEnd));
  });

  if (!hasCruzamento) {
    issues.push({
      severity: "alerta",
      rule: "sem-cruzamento-negocio",
      message: "Números foram citados, mas não parecem conectados a uma decisão ou mudança prática para o negócio do médico.",
    });
  }
}

function checkDuracao(
  content: string,
  tipo: ReuniaoTipo,
  issues: ReuniaoIssue[]
): number {
  const wordCount = countWords(content);
  const estimatedMinutes = wordCount / 140;
  const threshold = tipo === "mentoria" ? 25 : 8;

  if (estimatedMinutes < threshold) {
    issues.push({
      severity: "alerta",
      rule: "reuniao-curta",
      message: `Duração estimada de ~${Math.round(estimatedMinutes)} min pelo volume de texto, abaixo do esperado (${threshold} min) para esse tipo de reunião.`,
    });
  }

  return estimatedMinutes;
}

export function validateReuniao(tipo: ReuniaoTipo, content: string): ReuniaoValidation {
  const issues: ReuniaoIssue[] = [];
  const agenda: string[] = [];
  const wordCount = countWords(content);

  if (wordCount < 40) {
    issues.push({
      severity: "erro",
      rule: "conteudo-insuficiente",
      message: "A transcrição está curta demais para avaliar a reunião (menos de 40 palavras).",
    });
    return {
      status: "ajustar",
      score: 0,
      issues,
      wordCount,
      estimatedDurationMinutes: 0,
      suggestedAgenda: [],
    };
  }

  checkComprometimentos(content, issues, agenda);
  checkFalaDesequilibrada(content, issues);
  const estimatedDurationMinutes = checkDuracao(content, tipo, issues);
  if (tipo !== "onboarding") {
    checkNumerosENegocio(content, issues);
  }

  for (const issue of issues) {
    if (issue.severity === "alerta") {
      agenda.push(`Retomar: ${issue.message}`);
    }
  }

  const errorCount = issues.filter((i) => i.severity === "erro").length;
  const warningCount = issues.filter((i) => i.severity === "alerta").length;
  const score = Math.max(0, 100 - errorCount * 25 - warningCount * 10);
  const status: ReuniaoValidation["status"] = errorCount > 0 ? "ajustar" : "aprovado";

  return {
    status,
    score,
    issues,
    wordCount,
    estimatedDurationMinutes,
    suggestedAgenda: agenda,
  };
}
