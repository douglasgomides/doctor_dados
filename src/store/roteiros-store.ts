import { create } from "zustand";
import { Roteiro, RoteiroFormat } from "@/types";

interface RoteirosState {
  roteiros: Roteiro[];
  loading: boolean;
  lastResult: Roteiro | null;
  fetchRoteiros: (filters?: { status?: string; format?: string }) => Promise<void>;
  submitRoteiro: (data: {
    clientName: string;
    format: RoteiroFormat;
    title: string;
    content: string;
  }) => Promise<{ success: boolean; roteiro?: Roteiro; error?: string }>;
  reviewRoteiro: (
    id: string,
    data: { status?: Roteiro["status"]; reviewNote?: string }
  ) => Promise<void>;
}

export const useRoteirosStore = create<RoteirosState>()((set) => ({
  roteiros: [],
  loading: false,
  lastResult: null,

  fetchRoteiros: async (filters) => {
    set({ loading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.format) params.set("format", filters.format);
      const res = await fetch(`/api/roteiros?${params.toString()}`);
      const data = await res.json();
      if (data.roteiros) {
        set({ roteiros: data.roteiros });
      }
    } catch (error) {
      console.error("Erro ao buscar roteiros:", error);
    } finally {
      set({ loading: false });
    }
  },

  submitRoteiro: async (data) => {
    try {
      const res = await fetch("/api/roteiros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao validar roteiro." };
      }
      set((state) => ({
        roteiros: [result.roteiro, ...state.roteiros],
        lastResult: result.roteiro,
      }));
      return { success: true, roteiro: result.roteiro };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },

  reviewRoteiro: async (id, data) => {
    try {
      const res = await fetch(`/api/roteiros/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.roteiro) {
        set((state) => ({
          roteiros: state.roteiros.map((r) => (r.id === id ? result.roteiro : r)),
        }));
      }
    } catch (error) {
      console.error("Erro ao revisar roteiro:", error);
    }
  },
}));
