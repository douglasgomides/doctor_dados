import { create } from "zustand";
import { DashboardOverview } from "@/types";

interface OverviewState {
  overview: DashboardOverview | null;
  loading: boolean;
  error: string | null;
  fetchOverview: () => Promise<void>;
}

export const useOverviewStore = create<OverviewState>()((set) => ({
  overview: null,
  loading: false,
  error: null,

  fetchOverview: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/dashboard/overview");
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || "Erro ao carregar visão geral.", loading: false });
        return;
      }
      set({ overview: data, loading: false });
    } catch {
      set({ error: "Erro de conexão com o servidor.", loading: false });
    }
  },
}));
