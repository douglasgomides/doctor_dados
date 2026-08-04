import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ClintApiError } from "./errors.js";

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function jsonBlock(data: unknown): string {
  return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
}

/** Converte qualquer erro capturado num handler de ferramenta numa mensagem legível, sem nunca expor o token. */
export function describeError(error: unknown): string {
  if (error instanceof ClintApiError) {
    const details = error.body !== undefined ? `\nDetalhes retornados pela API: ${safeStringify(error.body)}` : "";
    if (error.isTimeout) {
      return `Timeout ao chamar a API da Clint: ${error.message}`;
    }
    if (error.isNetworkError) {
      return `Falha de rede ao chamar a API da Clint: ${error.message}`;
    }
    return `Erro ao chamar a API da Clint (HTTP ${error.status} ${error.statusText}): ${error.message}${details}`;
  }
  if (error instanceof Error) return `Erro inesperado: ${error.message}`;
  return `Erro inesperado: ${String(error)}`;
}

export function formatValue(value: unknown): string {
  if (value === undefined) return "(desconhecido)";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Envolve o handler de uma ferramenta para capturar exceções e devolvê-las
 * como um CallToolResult de erro em vez de propagar a exceção.
 */
export function safeHandler<Args>(
  fn: (args: Args) => Promise<CallToolResult>
): (args: Args) => Promise<CallToolResult> {
  return async (args: Args) => {
    try {
      return await fn(args);
    } catch (error) {
      return errorResult(describeError(error));
    }
  };
}
