import Anthropic from "@anthropic-ai/sdk";
import { DailyTarefaItem } from "@/types";
import { callClaudeTool } from "./ai-client";

// Extrator focado: não avalia qualidade, só puxa da transcrição da daily
// interna quem se comprometeu a fazer o quê e até quando — pra virar
// follow-up real (tarefa no ClickUp) em vez de ficar só na conversa.
const SYSTEM_PROMPT = `Você lê transcrições de dailies/reuniões internas da equipe da Doctor Creator (agência de marketing para médicos) e extrai os itens de ação combinados — quem vai fazer o quê, e até quando (se foi dito).

Regras:
- Só extraia compromissos REAIS e específicos ditos na conversa ("Thales, você fecha a página até sexta", "vou mandar o áudio pro Douglas"). Não invente tarefas genéricas.
- responsavel: o primeiro nome da pessoa que ficou responsável (como foi chamada na conversa).
- tarefa: descrição objetiva e curta da ação combinada.
- prazo: quando foi mencionado um prazo/data (ex: "até sexta", "amanhã", "essa semana"), coloque exatamente como foi dito; se não houver prazo claro, null.
- Se a transcrição não tiver nenhum compromisso claro de ação, retorne uma lista vazia — não invente.

Retorne SEMPRE chamando a ferramenta fornecida, com itens: lista de objetos {responsavel, tarefa, prazo}.`;

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    responsavel: { type: "string" },
    tarefa: { type: "string" },
    prazo: { type: ["string", "null"] },
  },
  required: ["responsavel", "tarefa", "prazo"],
};

const DAILY_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    itens: { type: "array", items: ITEM_SCHEMA },
  },
  required: ["itens"],
};

interface DailyAiResult {
  itens: DailyTarefaItem[];
}

export async function extractDailyItems(content: string): Promise<DailyTarefaItem[]> {
  if (content.trim().split(/\s+/).filter(Boolean).length < 20) {
    return [];
  }

  const result = await callClaudeTool<DailyAiResult>({
    system: SYSTEM_PROMPT,
    prompt: `Transcrição da daily:\n"""\n${content}\n"""`,
    toolName: "extrair_itens_daily",
    toolDescription: "Registra os itens de ação combinados na daily, com responsável e prazo.",
    schema: DAILY_SCHEMA,
  });

  return result.itens;
}
