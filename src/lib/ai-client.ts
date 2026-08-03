import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY não configurado no servidor.");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export async function callClaudeTool<T>(params: {
  system: string;
  prompt: string;
  toolName: string;
  toolDescription: string;
  schema: Anthropic.Tool.InputSchema;
}): Promise<T> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: { effort: "medium" },
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.schema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("A IA recusou a análise deste conteúdo.");
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new Error("A IA não retornou o resultado esperado.");
  }
  return toolUse.input as T;
}

export interface ValidatorIssue {
  severity: "erro" | "alerta";
  rule: string;
  message: string;
}

// status e issues vêm do mesmo tool-call da IA como campos independentes —
// nada garante que o modelo preencha os dois de forma coerente entre si
// (ex: status "aprovado" com uma issue severity "erro" junto). Recalcular
// aqui, a partir das próprias issues, garante que o badge visual (ver
// lib/status-tier.ts) nunca minta sobre um erro que a IA já detectou.
export function statusFromIssues(issues: ValidatorIssue[]): "aprovado" | "ajustar" {
  return issues.some((i) => i.severity === "erro") ? "ajustar" : "aprovado";
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
