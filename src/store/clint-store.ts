import { create } from "zustand";

export interface ClintWeeklyPoint {
  week: string;
  count: number;
}

export interface ClintOriginRow {
  originId: string | null;
  originName: string;
  total: number;
  won: number;
  lost: number;
  open: number;
  revenue: number;
}

export interface ClintProductRow {
  product: string;
  total: number;
  revenue: number;
}

export interface ClintStageRow {
  stage: string;
  stageId: string | null;
  count: number;
  value: number;
}

export interface ClintTagRow {
  name: string;
  count: number;
}

export interface ClintFonteRow {
  fonte: string;
  total: number;
  won: number;
  lost: number;
}

export interface ClintOriginProductRow {
  originName: string;
  product: string;
  total: number;
  revenue: number;
}

export interface ClintInsightSection {
  title: string;
  items: string[];
}

export interface ClintAction {
  titulo: string;
  porque: string;
  oque: string;
  impacto: "Alto" | "Médio" | "Baixo";
  prazo: string;
}

export interface ClintLossReasonRow {
  reason: string;
  total: number;
  value: number;
}

export interface ClintSellerRow {
  seller: string;
  total: number;
  revenue: number;
  avgTicket: number;
}

export interface ClintCycleTimePoint {
  week: string;
  avgDays: number;
}

export interface ClintPreviousPeriodOverview {
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  totalRevenue: number;
  totalContacts: number;
  winRate: number | null;
}

export interface ClintDashboardData {
  overview: {
    totalContacts: number;
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    lostDeals: number;
    totalRevenue: number;
    avgTicket: number;
    winRate: number | null;
    avgDaysToWin: number | null;
    contactsWithDeal: number;
    contactsWithoutDeal: number;
  };
  previousPeriod: ClintPreviousPeriodOverview | null;
  trends: {
    contactsWeekly: ClintWeeklyPoint[];
    dealsCreatedWeekly: ClintWeeklyPoint[];
    dealsWonWeekly: ClintWeeklyPoint[];
  };
  funnel: ClintStageRow[];
  lossByStage: ClintStageRow[];
  lossReasons: ClintLossReasonRow[];
  bySeller: ClintSellerRow[];
  cycleTimeTrend: ClintCycleTimePoint[];
  origins: ClintOriginRow[];
  products: ClintProductRow[];
  fontes: ClintFonteRow[];
  tags: ClintTagRow[];
  originProductCross: ClintOriginProductRow[];
  insightSections: ClintInsightSection[];
  actions: ClintAction[];
  productOptions: string[];
  originOptions: string[];
}

export interface ClintFilters {
  from?: string;
  to?: string;
  product?: string;
  origin?: string;
}

export interface ClintDealRow {
  id: string;
  contactId: string | null;
  contactName: string;
  status: string;
  stage: string | null;
  value: number;
  currency: string;
  createdAt: string | null;
  wonAt: string | null;
  originName: string;
  product: string | null;
  fonte: string | null;
  userName: string | null;
}

export interface ClintDealsResult {
  deals: ClintDealRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface ClintUnansweredChat {
  chatId: string;
  contactId: string;
  contactName: string;
  phone: string | null;
  firstCustomerMessageAt: string | null;
  lastMessageAt: string | null;
  status: string;
  stage: string | null;
  value: number | null;
  originName: string | null;
  channelName: string | null;
  channelType: string | null;
  lastMessageContent: string | null;
}

export interface ClintChannelAccount {
  id: string;
  name: string;
  type: string;
  status: string;
  identifier: string;
}

export interface ClintChannelStat {
  channelName: string;
  channelType: string;
  channelStatus: string | null;
  total: number;
  nuncaRespondido: number;
  avgResponseMinutes: number | null;
}

export interface ClintMultiChannelContact {
  contactId: string;
  contactName: string;
  channelCount: number;
  channelNames: string[];
  lastActivityAt: string | null;
}

export interface ClintRecentComment {
  id: string;
  chatId: string;
  content: string | null;
  createdAt: string;
  contactName: string;
  channelName: string | null;
  channelType: string | null;
}

export interface ClintAtendimentoData {
  overview: {
    totalChats: number;
    totalDirectMessages: number;
    totalComments: number;
    totalAtendimentoHumano: number;
    totalInfoproduto: number;
    totalComContato: number;
    nuncaRespondido: number;
    pctNuncaRespondido: number | null;
    avgResponseMinutes: number | null;
  };
  channels: ClintChannelAccount[];
  byChannel: (ClintChannelStat & { totalComments: number; totalInfoproduto: number })[];
  byOrigin: {
    originName: string;
    total: number;
    totalInfoproduto: number;
    nuncaRespondido: number;
    avgResponseMinutes: number | null;
  }[];
  unanswered: ClintUnansweredChat[];
  multiChannelContacts: ClintMultiChannelContact[];
  comments: {
    total: number;
    recent: ClintRecentComment[];
  };
}

interface ClintState {
  data: ClintDashboardData | null;
  loading: boolean;
  error: string | null;
  fetchData: (filters?: ClintFilters) => Promise<void>;

  deals: ClintDealsResult | null;
  dealsLoading: boolean;
  dealsError: string | null;
  fetchDeals: (
    params?: { search?: string; status?: string; offset?: number } & ClintFilters
  ) => Promise<void>;

  atendimento: ClintAtendimentoData | null;
  atendimentoLoading: boolean;
  atendimentoError: string | null;
  fetchAtendimento: (filters?: ClintFilters) => Promise<void>;
}

function appendFilters(query: URLSearchParams, filters?: ClintFilters) {
  if (filters?.from) query.set("from", filters.from);
  if (filters?.to) query.set("to", filters.to);
  if (filters?.product) query.set("product", filters.product);
  if (filters?.origin) query.set("origin", filters.origin);
}

export const useClintStore = create<ClintState>()((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchData: async (filters) => {
    set({ loading: true, error: null });
    try {
      const query = new URLSearchParams();
      appendFilters(query, filters);
      const qs = query.toString();
      const res = await fetch(`/api/dashboard/clint${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || "Erro ao carregar dados da Clint.", loading: false });
        return;
      }
      set({ data, loading: false });
    } catch {
      set({ error: "Erro de conexão com o servidor.", loading: false });
    }
  },

  deals: null,
  dealsLoading: false,
  dealsError: null,

  fetchDeals: async (params = {}) => {
    set({ dealsLoading: true, dealsError: null });
    try {
      const query = new URLSearchParams();
      if (params.search) query.set("search", params.search);
      if (params.status) query.set("status", params.status);
      appendFilters(query, params);
      query.set("offset", String(params.offset ?? 0));

      const res = await fetch(`/api/dashboard/clint/deals?${query.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        set({ dealsError: data.error || "Erro ao carregar negócios.", dealsLoading: false });
        return;
      }
      set({ deals: data, dealsLoading: false });
    } catch {
      set({ dealsError: "Erro de conexão com o servidor.", dealsLoading: false });
    }
  },

  atendimento: null,
  atendimentoLoading: false,
  atendimentoError: null,

  fetchAtendimento: async (filters) => {
    set({ atendimentoLoading: true, atendimentoError: null });
    try {
      const query = new URLSearchParams();
      appendFilters(query, filters);
      const qs = query.toString();
      const res = await fetch(`/api/dashboard/clint/atendimento${qs ? `?${qs}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        set({ atendimentoError: data.error || "Erro ao carregar atendimento.", atendimentoLoading: false });
        return;
      }
      set({ atendimento: data, atendimentoLoading: false });
    } catch {
      set({ atendimentoError: "Erro de conexão com o servidor.", atendimentoLoading: false });
    }
  },
}));
