const DEFAULT_PER_PAGE = 50;
const DEFAULT_MAX_PAGES = 20;

export interface PaginationInput {
  /** Página a buscar (1-based). Ignorado quando fetchAllPages=true. */
  page?: number;
  /** Itens por página. */
  perPage?: number;
  /** Quando true, busca automaticamente todas as páginas disponíveis. */
  fetchAllPages?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagesFetched: number;
  /** true quando o limite de segurança de páginas foi atingido antes do fim dos dados. */
  truncated: boolean;
}

interface NormalizedPage<T> {
  items: T[];
  hasMore: boolean;
}

/**
 * A API da Clint pode devolver listas como array puro, `{ data: [...] }`,
 * `{ data: [...], meta: {...} }` ou `{ items: [...], ... }`. Esta função
 * normaliza qualquer um desses formatos e infere se há mais páginas a
 * buscar, usando os metadados de paginação quando presentes e, na
 * ausência deles, o heurístico "página cheia == provavelmente há mais".
 */
function normalizeListResponse<T>(raw: unknown, requestedPerPage: number): NormalizedPage<T> {
  if (Array.isArray(raw)) {
    return { items: raw as T[], hasMore: raw.length >= requestedPerPage && raw.length > 0 };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const items = (Array.isArray(obj.data)
      ? obj.data
      : Array.isArray(obj.items)
        ? obj.items
        : Array.isArray(obj.results)
          ? obj.results
          : []) as T[];

    const meta = (obj.meta && typeof obj.meta === "object" ? (obj.meta as Record<string, unknown>) : obj) as Record<
      string,
      unknown
    >;

    const currentPage = toNumber(meta.current_page) ?? toNumber(meta.page);
    const lastPage = toNumber(meta.last_page) ?? toNumber(meta.total_pages);

    let hasMore: boolean;
    if (currentPage !== undefined && lastPage !== undefined) {
      hasMore = currentPage < lastPage;
    } else if (typeof obj.has_more === "boolean") {
      hasMore = obj.has_more;
    } else if (typeof meta.has_more === "boolean") {
      hasMore = meta.has_more;
    } else {
      hasMore = items.length >= requestedPerPage && items.length > 0;
    }

    return { items, hasMore };
  }

  return { items: [], hasMore: false };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

/**
 * Busca uma listagem paginada da Clint, opcionalmente percorrendo todas as
 * páginas automaticamente. `fetchPage` deve fazer a chamada GET real para a
 * página/perPage informados e devolver o corpo bruto da resposta.
 */
export async function paginatedList<T>(
  fetchPage: (page: number, perPage: number) => Promise<unknown>,
  options: PaginationInput,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<PaginatedResult<T>> {
  const perPage = options.perPage ?? DEFAULT_PER_PAGE;

  if (!options.fetchAllPages) {
    const page = options.page ?? 1;
    const raw = await fetchPage(page, perPage);
    const normalized = normalizeListResponse<T>(raw, perPage);
    return { items: normalized.items, pagesFetched: 1, truncated: false };
  }

  const items: T[] = [];
  let page = options.page ?? 1;
  let pagesFetched = 0;
  let truncated = false;

  for (;;) {
    const raw = await fetchPage(page, perPage);
    const normalized = normalizeListResponse<T>(raw, perPage);
    items.push(...normalized.items);
    pagesFetched += 1;

    if (!normalized.hasMore) break;
    if (pagesFetched >= maxPages) {
      truncated = true;
      break;
    }
    page += 1;
  }

  return { items, pagesFetched, truncated };
}
