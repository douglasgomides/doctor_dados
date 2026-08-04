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
  trends: {
    contactsWeekly: ClintWeeklyPoint[];
    dealsCreatedWeekly: ClintWeeklyPoint[];
    dealsWonWeekly: ClintWeeklyPoint[];
  };
  funnel: ClintStageRow[];
  origins: ClintOriginRow[];
  products: ClintProductRow[];
  fontes: ClintFonteRow[];
  tags: ClintTagRow[];
  originProductCross: ClintOriginProductRow[];
  insightSections: ClintInsightSection[];
  actions: ClintAction[];
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

export interface ClintAtendimentoData {
  overview: {
    totalChats: number;
    totalMessages: number;
    totalComContato: number;
    nuncaRespondido: number;
    pctNuncaRespondido: number | null;
    avgResponseMinutes: number | null;
  };
  channels: ClintChannelAccount[];
  byChannel: ClintChannelStat[];
  byOrigin: {
    originName: string;
    total: number;
    nuncaRespondido: number;
    avgResponseMinutes: number | null;
  }[];
  unanswered: ClintUnansweredChat[];
  multiChannelContacts: ClintMultiChannelContact[];
}

interface ClintState {
  data: ClintDashboardData | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;

  deals: ClintDealsResult | null;
  dealsLoading: boolean;
  dealsError: string | null;
  fetchDeals: (params?: { search?: string; status?: string; offset?: number }) => Promise<void>;

  atendimento: ClintAtendimentoData | null;
  atendimentoLoading: boolean;
  atendimentoError: string | null;
  fetchAtendimento: () => Promise<void>;
}

export const useClintStore = create<ClintState>()((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/dashboard/clint");
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
      query.set("offset", String(params.offset ?? 0));

      const res = await fetch(`/api/dashboard/clint/deals?${query.toString()}`);
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

  fetchAtendimento: async () => {
    set({ atendimentoLoading: true, atendimentoError: null });
    try {
      const res = await fetch("/api/dashboard/clint/atendimento");
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
