import Anthropic from "@anthropic-ai/sdk";
import { RoteiroFormat, RoteiroValidation } from "@/types";
import { callClaudeTool, statusFromIssues, clampScore } from "./ai-client";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const FORMAT_LABELS: Record<RoteiroFormat, string> = {
  reel: "Reels",
  carrossel: "Carrossel",
  stories: "Stories",
};

const SYSTEM_PROMPT = `Você é o revisor de qualidade de conteúdo da Doctor Creator, uma agência de marketing para médicos no Brasil. Avalie roteiros de Reels, Carrossel e Stories enviados pela equipe antes de irem para o médico/cliente aprovar, seguindo o "padrão ouro" de entrega da agência.

Critérios obrigatórios para TODOS os formatos:
- Compliance com a Resolução CFM nº 1.974/2011: proibido prometer resultado ou cura, usar superlativos ("o melhor", "o único", "número 1"), fazer comparação com outros profissionais, ou usar apelo sensacionalista/milagroso. Julgue o SENTIDO do texto, não apenas termos exatos — paráfrases e sinônimos da mesma promessa também violam a norma.
- Estrutura clara adequada ao formato (ver abaixo).
- Chamada para ação (CTA) explícita e clara ao final.
- Linguagem natural, sem parecer propaganda enganosa.

Critérios por formato:
- Reels: precisa ter um GANCHO claro nos primeiros segundos (que prenda atenção), um CORPO que entrega valor/informação, e um CTA final. Tempo de leitura estimado ideal entre 15 e 90 segundos (aprox. 2,5 palavras/segundo).
- Carrossel: precisa ter slides numerados e organizados (ideal 5 a 10 slides), com progressão lógica de ideia, e CTA claro no último slide.
- Stories: precisa ter frames/quadros numerados (ideal 7 a 10 frames), sequência que mantém o espectador, e CTA claro.

Retorne SEMPRE sua avaliação chamando a ferramenta fornecida, com:
- status: "aprovado" se não houver nenhum problema classificado como "erro"; "ajustar" caso contrário.
- score: nota de 0 a 100 (comece em 100 e desconte por gravidade: erro grave -25, alerta -10, sendo o mínimo 0).
- issues: lista de problemas encontrados, cada um com severity ("erro" para bloqueadores/compliance, "alerta" para melhorias recomendadas), rule (um slug curto identificando o tipo de problema, ex: "compliance-cfm", "estrutura-reel-gancho", "estrutura-reel-cta") e message (explicação objetiva e acionável em português, dizendo o que corrigir).
Se o roteiro estiver muito curto para avaliar (menos de ~15 palavras), retorne um único erro "conteudo-insuficiente" e score 0.`;

const ISSUE_SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "string", enum: ["erro", "alerta"] },
    rule: { type: "string" },
    message: { type: "string" },
  },
  required: ["severity", "rule", "message"],
};

const ROTEIRO_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["aprovado", "ajustar"] },
    score: { type: "number", minimum: 0, maximum: 100 },
    issues: { type: "array", items: ISSUE_SCHEMA },
  },
  required: ["status", "score", "issues"],
};

interface RoteiroAiResult {
  status: RoteiroValidation["status"];
  score: number;
  issues: RoteiroValidation["issues"];
}

export async function validateRoteiro(
  format: RoteiroFormat,
  content: string
): Promise<RoteiroValidation> {
  const wordCount = countWords(content);
  const readingTimeSeconds = format === "reel" ? wordCount / 2.5 : null;

  const result = await callClaudeTool<RoteiroAiResult>({
    system: SYSTEM_PROMPT,
    prompt: `Formato: ${FORMAT_LABELS[format]}\n\nRoteiro enviado pela equipe:\n"""\n${content}\n"""`,
    toolName: "avaliar_roteiro",
    toolDescription:
      "Registra a avaliação de qualidade do roteiro segundo o padrão ouro da Doctor Creator.",
    schema: ROTEIRO_SCHEMA,
  });

  return {
    status: statusFromIssues(result.issues),
    score: clampScore(result.score),
    issues: result.issues,
    wordCount,
    readingTimeSeconds,
  };
}
