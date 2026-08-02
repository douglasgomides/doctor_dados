import { create } from "zustand";
import { ComercialAnalise } from "@/types";

interface ComercialState {
  analises: ComercialAnalise[];
  loading: boolean;
  error: string | null;
  fetchAnalises: () => Promise<void>;
}

export const useComercialStore = create<ComercialState>()((set) => ({
  analises: [],
  loading: false,
  error: null,

  fetchAnalises: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/comercial");
      const data = await res.json();
      if (!res.ok) {
        set({ error: data.error || "Erro ao carregar análises comerciais.", loading: false });
        return;
      }
      set({ analises: data.analises, loading: false });
    } catch {
      set({ error: "Erro de conexão com o servidor.", loading: false });
    }
  },
}));
