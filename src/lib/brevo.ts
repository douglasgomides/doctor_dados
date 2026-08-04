// Cliente HTTP mínimo para a API v3 da Brevo, usado só pela sincronização
// server-side (src/lib/brevo-sync.ts). Formatos de resposta conferidos
// contra o SDK oficial (@getbrevo/brevo, tipos GetContacts/GetContactDetails/
// GetEmailCampaigns/GetExtendedCampaignOverview/GetCampaignStats) — não
// testados ao vivo neste ambiente porque a rede daqui bloqueia
// api.brevo.com (só funciona a partir do deploy em produção).

const BREVO_BASE_URL = "https://api.brevo.com/v3";
const BREVO_TIMEOUT_MS = 20_000;

export interface BrevoContact {
  id: number;
  email?: string;
  attributes: Record<string, unknown>;
  listIds: number[];
  emailBlacklisted: boolean;
  smsBlacklisted: boolean;
  whatsappBlacklisted?: boolean;
  createdAt: string;
  modifiedAt: string;
}

export interface BrevoContactsResponse {
  contacts: BrevoContact[];
  count: number;
}

export interface BrevoCampaignStats {
  clickers: number | null;
  complaints: number | null;
  delivered: number | null;
  hardBounces: number | null;
  opensRate: number | null;
  sent: number | null;
  softBounces: number | null;
  uniqueClicks: number | null;
  uniqueViews: number | null;
  unsubscriptions: number | null;
  viewed: number | null;
  [key: string]: unknown;
}

export interface BrevoCampaign {
  id: number;
  name: string;
  subject?: string;
  type: "classic" | "trigger";
  status: string;
  sentDate?: string;
  createdAt: string;
  modifiedAt: string;
  statistics?: { globalStats?: BrevoCampaignStats };
}

export interface BrevoCampaignsResponse {
  campaigns: BrevoCampaign[];
  count: number;
}

async function brevoRequest<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY não configurado no servidor.");

  const url = new URL(BREVO_BASE_URL + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), BREVO_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { "api-key": apiKey, Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo API respondeu ${res.status} para ${path}: ${body.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export function fetchContactsPage(offset: number, limit = 500) {
  return brevoRequest<BrevoContactsResponse>("/contacts", { limit, offset, sort: "asc" });
}

// "statistics=globalStats" traz os agregados (envios/aberturas/cliques) da
// campanha direto na listagem, sem precisar de uma chamada por campanha.
export function fetchEmailCampaignsPage(offset: number, limit = 50) {
  return brevoRequest<BrevoCampaignsResponse>("/emailCampaigns", {
    limit,
    offset,
    sort: "desc",
    statistics: "globalStats",
  });
}
