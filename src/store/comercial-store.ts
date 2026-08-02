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
  updateConteudo: (
    id: string,
    data: { titulo?: string; participantes?: string[]; content?: string }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteAnalise: (id: string) => Promise<{ success: boolean; error?: string }>;
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

  updateConteudo: async (id, data) => {
    try {
      const res = await fetch(`/api/comercial/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao editar call comercial." };
      }
      set({ analises: get().analises.map((a) => (a.id === id ? result.analise : a)) });
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },

  deleteAnalise: async (id) => {
    try {
      const res = await fetch(`/api/comercial/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao excluir call comercial." };
      }
      set({ analises: get().analises.filter((a) => a.id !== id) });
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },
}));
