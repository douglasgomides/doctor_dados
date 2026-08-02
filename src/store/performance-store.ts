import { create } from "zustand";
import { PerformanceOverview } from "@/types";

interface PerformanceState {
  overview: PerformanceOverview | null;
  loading: boolean;
  error: string | null;
  fetchPerformance: () => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>()((set) => ({
  overview: null,
  loading: false,
  error: null,

  fetchPerformance: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/dashboard/performance");
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || "Erro ao carregar performance.", loading: false });
        return;
      }
      set({ overview: data, loading: false });
    } catch {
      set({ error: "Erro de conexão com o servidor.", loading: false });
    }
  },
}));
