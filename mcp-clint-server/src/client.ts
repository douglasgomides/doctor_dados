import { ClintApiError } from "./errors.js";

const DEFAULT_BASE_URL = "https://api.clint.digital";
const DEFAULT_TIMEOUT_MS = 15_000;

export type QueryValue = string | number | boolean | undefined | null | Array<string | number>;
export type QueryParams = Record<string, QueryValue>;

export interface ClintClientOptions {
  /** Sobrescreve process.env.CLINT_API_TOKEN. Usado principalmente em testes. */
  token?: string;
  /** Sobrescreve process.env.CLINT_API_BASE_URL. */
  baseUrl?: string;
  /** Sobrescreve process.env.CLINT_API_TIMEOUT_MS. */
  timeoutMs?: number;
  /** Implementação de fetch a usar. Usado principalmente em testes. */
  fetchImpl?: typeof fetch;
}

interface RequestOptions {
  method?: "GET" | "POST";
  query?: QueryParams;
  body?: unknown;
}

/**
 * Cliente HTTP centralizado para a API da Clint. Todas as ferramentas MCP
 * devem passar por aqui — nenhuma delas deve chamar fetch diretamente.
 *
 * Responsabilidades: montar a URL e o header de autenticação, aplicar
 * timeout, e normalizar erros HTTP/rede/timeout em ClintApiError.
 */
export class ClintClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClintClientOptions = {}) {
    const token = options.token ?? process.env.CLINT_API_TOKEN;
    if (!token) {
      throw new Error(
        "CLINT_API_TOKEN não está definido. Configure a variável de ambiente antes de iniciar o servidor MCP."
      );
    }
    this.token = token;
    this.baseUrl = (options.baseUrl ?? process.env.CLINT_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

    const timeoutFromEnv = process.env.CLINT_API_TIMEOUT_MS ? Number(process.env.CLINT_API_TIMEOUT_MS) : undefined;
    this.timeoutMs = options.timeoutMs ?? timeoutFromEnv ?? DEFAULT_TIMEOUT_MS;

    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>(path, { method: "GET", query });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: "POST", body });
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    const method = options.method ?? "GET";
    const url = this.buildUrl(path, options.query);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers: {
          "api-token": this.token,
          Accept: "application/json",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ClintApiError(
          `Timeout de ${this.timeoutMs}ms excedido ao chamar ${method} ${path}`,
          0,
          "Timeout",
          undefined
        );
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new ClintApiError(`Falha de rede ao chamar ${method} ${path}: ${reason}`, 0, "NetworkError", undefined);
    } finally {
      clearTimeout(timeoutHandle);
    }

    const payload = await parseResponseBody(response);

    if (!response.ok) {
      throw new ClintApiError(
        `Clint API respondeu ${response.status} ${response.statusText} para ${method} ${path}`,
        response.status,
        response.statusText,
        payload
      );
    }

    return payload as T;
  }

  private buildUrl(path: string, query?: QueryParams): string {
    const url = new URL(this.baseUrl + (path.startsWith("/") ? path : `/${path}`));
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          for (const item of value) url.searchParams.append(key, String(item));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
