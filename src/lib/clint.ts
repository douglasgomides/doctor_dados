// Cliente HTTP mínimo para a API da Clint, usado só pela sincronização
// server-side (src/lib/clint-sync.ts). Formatos de resposta confirmados
// manualmente contra a conta real (não documentados publicamente de forma
// acessível): GET /v1/contacts e GET /v1/deals devolvem
// { status, totalCount, page, totalPages, hasNext, hasPrevious, data }.

const CLINT_BASE_URL = process.env.CLINT_API_BASE_URL || "https://api.clint.digital";
const CLINT_TIMEOUT_MS = 20_000;

export interface ClintListResponse<T> {
  status: number;
  totalCount: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  data: T[];
}

export interface ClintContact {
  id: string;
  name: string | null;
  email: string | null;
  ddi: string | null;
  phone: string | null;
  username: string | null;
  fullPhone: string | null;
  organization: { id: string; name: string | null; fields: Record<string, unknown> } | null;
  tags: { id: string; name: string; color: string }[];
  fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClintDealUser {
  id: string;
  email: string;
  full_name: string;
}

export interface ClintDealContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  ddi: string | null;
  instagram: string | null;
}

export interface ClintDeal {
  id: string;
  origin_id: string;
  user: ClintDealUser | null;
  contact: ClintDealContact | null;
  created_at: string;
  updated_stage_at: string;
  updated_at: string;
  status: "OPEN" | "WON" | "LOST";
  won_at: string | null;
  won_by: string | null;
  lost_status_id: string | null;
  lost_at: string | null;
  lost_by: string | null;
  fields: Record<string, unknown>;
  stage: string;
  value: number;
  currency: string;
  stage_id: string;
}

export interface ClintOrigin {
  id: string;
  name: string;
}

export interface ClintTag {
  id: string;
  name: string;
  color: string;
}

async function clintRequest<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const token = process.env.CLINT_API_TOKEN;
  if (!token) throw new Error("CLINT_API_TOKEN não configurado no servidor.");

  const url = new URL(CLINT_BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), CLINT_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { "api-token": token, Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Clint API respondeu ${res.status} para ${path}: ${body.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function fetchContactsPage(page: number, perPage = 200) {
  return clintRequest<ClintListResponse<ClintContact>>("/v1/contacts", { page, per_page: perPage });
}

export function fetchDealsPage(page: number, perPage = 200) {
  return clintRequest<ClintListResponse<ClintDeal>>("/v1/deals", { page, per_page: perPage });
}

export function fetchOriginsPage(page: number, perPage = 200) {
  return clintRequest<ClintListResponse<ClintOrigin>>("/v1/origins", { page, per_page: perPage });
}

export function fetchTagsPage(page: number, perPage = 200) {
  return clintRequest<ClintListResponse<ClintTag>>("/v1/tags", { page, per_page: perPage });
}
