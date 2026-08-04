import { create } from "zustand";
import { Pendencia } from "@/types";

interface PendenciasState {
  pendencias: Pendencia[];
  loading: boolean;
  fetchPendencias: () => Promise<void>;
}

export const usePendenciasStore = create<PendenciasState>()((set) => ({
  pendencias: [],
  loading: false,

  fetchPendencias: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/dashboard/pendencias");
      if (!res.ok) return;
      const data = await res.json();
      if (data.pendencias) {
        set({ pendencias: data.pendencias });
      }
    } catch (error) {
      console.error("Erro ao buscar pendências:", error);
    } finally {
      set({ loading: false });
    }
  },
}));
