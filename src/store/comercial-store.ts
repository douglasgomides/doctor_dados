import { create } from "zustand";
import { ComercialAnalise, ComercialResultado } from "@/types";

interface ComercialState {
  analises: ComercialAnalise[];
  loading: boolean;
  error: string | null;
  fetchAnalises: () => Promise<void>;
  updateResultado: (
    id: string,
    resultado: ComercialResultado | null,
    valorFechado: number | null
  ) => Promise<boolean>;
}

export const useComercialStore = create<ComercialState>()((set, get) => ({
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

  updateResultado: async (id, resultado, valorFechado) => {
    try {
      const res = await fetch(`/api/comercial/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultado, valorFechado }),
      });
      const data = await res.json();
      if (!res.ok) return false;
      set({ analises: get().analises.map((a) => (a.id === id ? data.analise : a)) });
      return true;
    } catch {
      return false;
    }
  },
}));
