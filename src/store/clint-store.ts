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
  insights: string[];
}

interface ClintState {
  data: ClintDashboardData | null;
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
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
}));
