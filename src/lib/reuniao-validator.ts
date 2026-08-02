import Anthropic from "@anthropic-ai/sdk";
import { ReuniaoTipo, ReuniaoValidation } from "@/types";
import { callClaudeTool } from "./ai-client";

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const TIPO_LABELS: Record<ReuniaoTipo, string> = {
  mentoria: "Mentoria (mensal/quinzenal)",
  grupo: "Reunião em grupo",
  onboarding: "Onboarding",
  pontual: "Pontual / Emergencial",
};

const DURATION_THRESHOLD_MINUTES = {
  mentoriaOuGrupo: 25,
  onboardingOuPontual: 8,
};

const SYSTEM_PROMPT = `Você é o revisor de qualidade de reuniões da Doctor Creator, uma agência de marketing para médicos no Brasil. Avalie transcrições de reuniões (gravadas e transcritas via Meet) entre a equipe/consultoria e o médico-cliente, seguindo o "padrão ouro" de entrega da agência.

Requisitos OBRIGATÓRIOS (a ausência de qualquer um deles é um "erro"):
1. Próxima reunião marcada com data ou dia claramente definido.
2. Uma ação prática combinada para o MÉDICO cumprir até a próxima reunião.
3. Uma entrega da CONSULTORIA/equipe combinada até a próxima reunião.

Sinais de alerta a observar (cada um vira um "alerta" quando detectado):
- Fala desequilibrada: um dos participantes (geralmente a consultoria) dominou a conversa (~75%+ do tempo/palavras), deixando pouco espaço para o médico falar.
- Números e performance (seguidores, alcance, engajamento, cliques, leads, consultas, %, R$) foram citados mas NÃO foram conectados a nenhuma decisão prática ou mudança de estratégia para o negócio do médico — ou nenhum número/performance foi mencionado (não se aplica a reuniões de onboarding).
- Duração da reunião parece curta demais para o tipo: mínimo esperado de ~${DURATION_THRESHOLD_MINUTES.mentoriaOuGrupo} min para mentoria/grupo e ~${DURATION_THRESHOLD_MINUTES.onboardingOuPontual} min para onboarding/pontual, estimando pela quantidade de conteúdo da transcrição.
- Qualquer outro sinal relevante de reunião rasa, sem direção clara, ou sem meta objetiva.

Além da avaliação, sintetize uma pauta sugerida (suggestedAgenda) para a PRÓXIMA reunião: itens objetivos a retomar/cobrar, com base nos compromissos assumidos e nos alertas identificados nesta reunião.

Sintetize também de 3 a 5 ideias de conteúdo (suggestedContentIdeas) para Reels/Carrossel/Stories, extraídas do que foi REALMENTE dito na reunião — dúvidas do médico, perguntas de pacientes que ele mencionou, objeções, casos/temas que ele quer abordar, resultados discutidos. Nunca sugira temas genéricos desconectados da conversa; se a transcrição não trouxer material suficiente para uma ideia de conteúdo, retorne uma lista menor (pode ser vazia) em vez de inventar.

Retorne SEMPRE sua avaliação chamando a ferramenta fornecida, com:
- status: "aprovado" se não houver nenhum "erro" (requisito obrigatório ausente); "ajustar" caso contrário.
- score: nota de 0 a 100 (comece em 100 e desconte: erro -25, alerta -10, mínimo 0).
- issues: lista de problemas, cada um com severity ("erro" para requisito obrigatório ausente, "alerta" para sinal de risco), rule (slug curto, ex: "comprometimento-data", "comprometimento-medico", "comprometimento-consultoria", "fala-desequilibrada", "sem-cruzamento-negocio", "reuniao-curta") e message (explicação objetiva em português).
- suggestedAgenda: lista de strings com os itens objetivos para a pauta da próxima reunião.
- suggestedContentIdeas: lista de ideias de conteúdo, cada uma com format ("reel", "carrossel" ou "stories" — o que melhor se encaixa no tema) e tema (uma frase curta descrevendo o ângulo do conteúdo, específica o suficiente pra virar um roteiro).`;

const ISSUE_SCHEMA = {
  type: "object",
  properties: {
    severity: { type: "string", enum: ["erro", "alerta"] },
    rule: { type: "string" },
    message: { type: "string" },
  },
  required: ["severity", "rule", "message"],
};

const CONTENT_IDEA_SCHEMA = {
  type: "object",
  properties: {
    format: { type: "string", enum: ["reel", "carrossel", "stories"] },
    tema: { type: "string" },
  },
  required: ["format", "tema"],
};

const REUNIAO_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["aprovado", "ajustar"] },
    score: { type: "number", minimum: 0, maximum: 100 },
    issues: { type: "array", items: ISSUE_SCHEMA },
    suggestedAgenda: { type: "array", items: { type: "string" } },
    suggestedContentIdeas: { type: "array", items: CONTENT_IDEA_SCHEMA },
  },
  required: ["status", "score", "issues", "suggestedAgenda", "suggestedContentIdeas"],
};

interface ReuniaoAiResult {
  status: ReuniaoValidation["status"];
  score: number;
  issues: ReuniaoValidation["issues"];
  suggestedAgenda: string[];
  suggestedContentIdeas: ReuniaoValidation["suggestedContentIdeas"];
}

export async function validateReuniao(
  tipo: ReuniaoTipo,
  content: string
): Promise<ReuniaoValidation> {
  const wordCount = countWords(content);
  const estimatedDurationMinutes = wordCount / 140;

  if (wordCount < 40) {
    return {
      status: "ajustar",
      score: 0,
      issues: [
        {
          severity: "erro",
          rule: "conteudo-insuficiente",
          message:
            "A transcrição está curta demais para avaliar a reunião (menos de 40 palavras).",
        },
      ],
      wordCount,
      estimatedDurationMinutes,
      suggestedAgenda: [],
      suggestedContentIdeas: [],
    };
  }

  const result = await callClaudeTool<ReuniaoAiResult>({
    system: SYSTEM_PROMPT,
    prompt: `Tipo de reunião: ${TIPO_LABELS[tipo]}\nDuração estimada pela quantidade de texto: ~${Math.round(
      estimatedDurationMinutes
    )} min\n\nTranscrição:\n"""\n${content}\n"""`,
    toolName: "avaliar_reuniao",
    toolDescription:
      "Registra a avaliação de qualidade da reunião segundo o padrão ouro da Doctor Creator.",
    schema: REUNIAO_SCHEMA,
  });

  const score = Math.max(0, Math.min(100, Math.round(result.score)));

  return {
    status: result.status,
    score,
    issues: result.issues,
    wordCount,
    estimatedDurationMinutes,
    suggestedAgenda: result.suggestedAgenda,
    suggestedContentIdeas: result.suggestedContentIdeas,
  };
}
