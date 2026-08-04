import { describe, expect, it, vi } from "vitest";
import { ClintClient } from "../src/client.js";
import { ClintApiError } from "../src/errors.js";

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    headers: { "Content-Type": "application/json" },
  });
}

/** Simula um fetch que resolve depois de `delayMs`, mas respeita o AbortSignal — como o fetch real. */
function abortableFetch(delayMs: number, response: () => Response): typeof fetch {
  return vi.fn((_url: string | URL, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(response()), delayMs);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        reject(error);
      });
    });
  }) as unknown as typeof fetch;
}

describe("ClintClient", () => {
  it("lança erro se nenhum token for fornecido", () => {
    const originalToken = process.env.CLINT_API_TOKEN;
    delete process.env.CLINT_API_TOKEN;
    try {
      expect(() => new ClintClient({ fetchImpl: vi.fn() as unknown as typeof fetch })).toThrow(
        /CLINT_API_TOKEN não está definido/
      );
    } finally {
      if (originalToken !== undefined) process.env.CLINT_API_TOKEN = originalToken;
    }
  });

  it("envia o header api-token e nunca inclui o token na URL", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["api-token"]).toBe("secret-token");
      expect(String(url)).not.toContain("secret-token");
      return jsonResponse({ ok: true });
    }) as unknown as typeof fetch;

    const client = new ClintClient({ token: "secret-token", fetchImpl });
    await client.get("/v1/contacts");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("monta a URL com query params, ignorando undefined/null e serializando arrays como múltiplos params", async () => {
    let capturedUrl = "";
    const fetchImpl = vi.fn(async (url: string | URL) => {
      capturedUrl = String(url);
      return jsonResponse([]);
    }) as unknown as typeof fetch;

    const client = new ClintClient({ token: "t", baseUrl: "https://api.clint.digital/", fetchImpl });
    await client.get("/v1/contacts", { name: "Ana", email: undefined, tags: ["vip", "novo"], page: 2 });

    const url = new URL(capturedUrl);
    expect(url.origin + url.pathname).toBe("https://api.clint.digital/v1/contacts");
    expect(url.searchParams.get("name")).toBe("Ana");
    expect(url.searchParams.has("email")).toBe(false);
    expect(url.searchParams.getAll("tags")).toEqual(["vip", "novo"]);
    expect(url.searchParams.get("page")).toBe("2");
  });

  it("envia o corpo como JSON e o header Content-Type em requisições POST", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      expect(init?.body).toBe(JSON.stringify({ name: "Novo Contato" }));
      return jsonResponse({ id: "123", name: "Novo Contato" }, { status: 201 });
    }) as unknown as typeof fetch;

    const client = new ClintClient({ token: "t", fetchImpl });
    const result = await client.post<{ id: string }>("/v1/contacts", { name: "Novo Contato" });

    expect(result.id).toBe("123");
  });

  it("lança ClintApiError com status e corpo quando a API responde com erro", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "Contato não encontrado" }, { status: 404, statusText: "Not Found" })) as unknown as typeof fetch;

    const client = new ClintClient({ token: "t", fetchImpl });

    await expect(client.get("/v1/contacts/999")).rejects.toMatchObject({
      name: "ClintApiError",
      status: 404,
      statusText: "Not Found",
      body: { message: "Contato não encontrado" },
    });
  });

  it("nunca inclui o token na mensagem de erro", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: "erro" }, { status: 500 })) as unknown as typeof fetch;
    const client = new ClintClient({ token: "super-secret", fetchImpl });

    try {
      await client.get("/v1/contacts");
      expect.unreachable("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(ClintApiError);
      expect((error as ClintApiError).message).not.toContain("super-secret");
    }
  });

  it("lança ClintApiError de timeout quando a requisição excede timeoutMs", async () => {
    const fetchImpl = abortableFetch(5000, () => jsonResponse({}));
    const client = new ClintClient({ token: "t", timeoutMs: 20, fetchImpl });

    const error = await client.get("/v1/contacts").catch((e) => e);
    expect(error).toBeInstanceOf(ClintApiError);
    expect((error as ClintApiError).isTimeout).toBe(true);
  });

  it("lança ClintApiError de rede quando o fetch falha por outro motivo", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND api.clint.digital");
    }) as unknown as typeof fetch;

    const client = new ClintClient({ token: "t", fetchImpl });
    const error = await client.get("/v1/contacts").catch((e) => e);

    expect(error).toBeInstanceOf(ClintApiError);
    expect((error as ClintApiError).isNetworkError).toBe(true);
  });

  it("devolve undefined para corpo de resposta vazio e texto bruto para corpo não-JSON", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("not json", { status: 200 })) as unknown as typeof fetch;

    const client = new ClintClient({ token: "t", fetchImpl });

    expect(await client.get("/v1/contacts/1")).toBeUndefined();
    expect(await client.get("/v1/contacts/2")).toBe("not json");
  });
});
