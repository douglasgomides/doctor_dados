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
