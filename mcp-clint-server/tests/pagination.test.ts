import { describe, expect, it, vi } from "vitest";
import { paginatedList } from "../src/pagination.js";

describe("paginatedList", () => {
  it("busca apenas uma página quando fetchAllPages não é informado", async () => {
    const fetchPage = vi.fn(async () => ({ data: [1, 2, 3] }));

    const result = await paginatedList(fetchPage, { page: 1, perPage: 50 });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(1, 50);
    expect(result).toEqual({ items: [1, 2, 3], pagesFetched: 1, truncated: false });
  });

  it("percorre todas as páginas automaticamente até meta.current_page === meta.last_page", async () => {
    const pages = [
      { data: ["a", "b"], meta: { current_page: 1, last_page: 3 } },
      { data: ["c", "d"], meta: { current_page: 2, last_page: 3 } },
      { data: ["e"], meta: { current_page: 3, last_page: 3 } },
    ];
    const fetchPage = vi.fn(async (page: number) => pages[page - 1]);

    const result = await paginatedList(fetchPage, { fetchAllPages: true, perPage: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.items).toEqual(["a", "b", "c", "d", "e"]);
    expect(result.pagesFetched).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it("para quando uma página vem incompleta (heurística sem metadados)", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce([1, 2])
      .mockResolvedValueOnce([3]);

    const result = await paginatedList(fetchPage, { fetchAllPages: true, perPage: 2 });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.items).toEqual([1, 2, 3]);
  });

  it("respeita o limite de segurança de páginas e marca truncated=true", async () => {
    const fetchPage = vi.fn(async () => [1, 2]); // sempre "página cheia" -> sempre hasMore

    const result = await paginatedList(fetchPage, { fetchAllPages: true, perPage: 2 }, 3);

    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.truncated).toBe(true);
    expect(result.items).toHaveLength(6);
  });

  it("lida com respostas em array puro", async () => {
    const fetchPage = vi.fn(async () => [{ id: 1 }, { id: 2 }]);
    const result = await paginatedList(fetchPage, { perPage: 50 });
    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
