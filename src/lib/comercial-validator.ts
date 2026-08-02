import Anthropic from "@anthropic-ai/sdk";
import { ComercialIssue, ComercialStatus } from "@/types";
import { callClaudeTool } from "./ai-client";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// A cultura comercial descrita aqui vem de uma reunião real de alinhamento
// da própria Doctor Creator ("venda saudável", "vendedor consultivo",
// "ajudar antes de vender") — não é um padrão genérico de mercado, é o que
// a liderança já definiu como o jeito certo de vender da empresa.
const SYSTEM_PROMPT = `Você é o analista de qualidade comercial da Doctor Creator, uma agência de marketing para médicos no Brasil. Avalie transcrições de calls comerciais (venda, prospecção, negociação) segundo a cultura de vendas que a própria liderança da empresa já definiu:

- Venda SAUDÁVEL: conduzida respeitando prazo, horário e o roteiro/script combinado — sem empurrar venda a qualquer custo.
- Postura CONSULTIVA: o vendedor se posiciona como especialista que ajuda o prospect a entender o próprio problema antes de tentar vender — não é só "querer vender, querer vender, querer vender".
- Descoberta genuína: perguntas reais sobre a dor, o momento e o objetivo do prospect antes de apresentar a oferta.
- Sem promessa exagerada ou antiética: nada de garantir resultado, criar urgência falsa ou pressionar de forma manipuladora.
- Fechamento claro: a call termina com um próximo passo definido (mesmo que seja "não still", desde que explícito) — não pode terminar em ambiguidade sobre o que acontece depois.

Avalie a transcrição com esses critérios e retorne, chamando a ferramenta fornecida:
- status: "aprovado" se a call seguiu bem a cultura acima; "ajustar" se houve falha relevante (pressão indevida, promessa exagerada, sem próximo passo definido, zero descoberta).
- score: nota de 0 a 100 (comece em 100 e desconte: erro grave -25, alerta -10, mínimo 0).
- issues: lista de problemas encontrados, cada um com severity ("erro" para violação grave da cultura comercial, "alerta" para oportunidade perdida) e rule (slug curto, ex: "sem-proximo-passo", "promessa-exagerada", "sem-descoberta", "pressao-indevida") e message (explicação objetiva em português, com sugestão do que fazer diferente).
- pontosFortes: lista de strings — o que o vendedor fez bem nessa call, especificamente (não genérico).
- pontosMelhoria: lista de strings — o que especificamente poderia ter sido melhor, de forma acionável.
Se a transcrição não tiver conteúdo suficiente pra avaliar (menos de ~40 palavras), retorne um único erro "conteudo-insuficiente", score 0, e listas vazias.`;

const ISSUE_SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "string", enum: ["erro", "alerta"] },
    rule: { type: "string" },
    message: { type: "string" },
  },
  required: ["severity", "rule", "message"],
};

const COMERCIAL_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["aprovado", "ajustar"] },
    score: { type: "number", minimum: 0, maximum: 100 },
    issues: { type: "array", items: ISSUE_SCHEMA },
    pontosFortes: { type: "array", items: { type: "string" } },
    pontosMelhoria: { type: "array", items: { type: "string" } },
  },
  required: ["status", "score", "issues", "pontosFortes", "pontosMelhoria"],
};

export interface ComercialValidation {
  status: ComercialStatus;
  score: number;
  issues: ComercialIssue[];
  pontosFortes: string[];
  pontosMelhoria: string[];
}

interface ComercialAiResult {
  status: ComercialStatus;
  score: number;
  issues: ComercialIssue[];
  pontosFortes: string[];
  pontosMelhoria: string[];
}

export async function validateComercial(content: string): Promise<ComercialValidation> {
  if (countWords(content) < 40) {
    return {
      status: "ajustar",
      score: 0,
      issues: [
        {
          severity: "erro",
          rule: "conteudo-insuficiente",
          message: "A transcrição está curta demais para avaliar a call (menos de 40 palavras).",
        },
      ],
      pontosFortes: [],
      pontosMelhoria: [],
    };
  }

  const result = await callClaudeTool<ComercialAiResult>({
    system: SYSTEM_PROMPT,
    prompt: `Transcrição da call comercial:\n"""\n${content}\n"""`,
    toolName: "avaliar_call_comercial",
    toolDescription:
      "Registra a avaliação de qualidade da call comercial segundo a cultura de vendas da Doctor Creator.",
    schema: COMERCIAL_SCHEMA,
  });

  return {
    status: result.status,
    score: Math.max(0, Math.min(100, Math.round(result.score))),
    issues: result.issues,
    pontosFortes: result.pontosFortes,
    pontosMelhoria: result.pontosMelhoria,
  };
}
