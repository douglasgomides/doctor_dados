import { create } from "zustand";
import { Reuniao, ReuniaoTipo } from "@/types";

interface ReunioesState {
  reunioes: Reuniao[];
  loading: boolean;
  fetchReunioes: (filters?: { status?: string; tipo?: string }) => Promise<void>;
  submitReuniao: (data: {
    clientName: string;
    tipo: ReuniaoTipo;
    content: string;
  }) => Promise<{ success: boolean; reuniao?: Reuniao; error?: string }>;
  reviewReuniao: (
    id: string,
    data: {
      status?: Reuniao["status"];
      reviewNote?: string;
      clientName?: string;
      tipo?: ReuniaoTipo;
      content?: string;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteReuniao: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export const useReunioesStore = create<ReunioesState>()((set) => ({
  reunioes: [],
  loading: false,

  fetchReunioes: async (filters) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.tipo) params.set("tipo", filters.tipo);
      const res = await fetch(`/api/reunioes?${params.toString()}`);
      const data = await res.json();
      if (data.reunioes) {
        set({ reunioes: data.reunioes });
      }
    } catch (error) {
      console.error("Erro ao buscar reuniões:", error);
    } finally {
      set({ loading: false });
    }
  },

  submitReuniao: async (data) => {
    try {
      const res = await fetch("/api/reunioes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao validar reunião." };
      }
      set((state) => ({ reunioes: [result.reuniao, ...state.reunioes] }));
      return { success: true, reuniao: result.reuniao };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },

  reviewReuniao: async (id, data) => {
    try {
      const res = await fetch(`/api/reunioes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao editar reunião." };
      }
      set((state) => ({
        reunioes: state.reunioes.map((r) => (r.id === id ? result.reuniao : r)),
      }));
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },

  deleteReuniao: async (id) => {
    try {
      const res = await fetch(`/api/reunioes/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao excluir reunião." };
      }
      set((state) => ({ reunioes: state.reunioes.filter((r) => r.id !== id) }));
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },
}));
