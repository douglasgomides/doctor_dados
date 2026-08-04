/**
 * Erro lançado pelo ClintClient para qualquer falha de comunicação com a
 * API da Clint (status HTTP de erro, timeout ou falha de rede).
 *
 * `body` nunca contém o token de autenticação — apenas o corpo da resposta
 * devolvido pela API (quando houver).
 */
export class ClintApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;

  constructor(message: string, status: number, statusText: string, body: unknown) {
    super(message);
    this.name = "ClintApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }

  /** true quando o erro veio de um timeout de requisição. */
  get isTimeout(): boolean {
    return this.statusText === "Timeout";
  }

  /** true quando o erro veio de uma falha de rede (sem resposta do servidor). */
  get isNetworkError(): boolean {
    return this.statusText === "NetworkError";
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      statusText: this.statusText,
      body: this.body,
    };
  }
}
