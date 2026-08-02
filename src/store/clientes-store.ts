import { create } from "zustand";
import { Cliente } from "@/types";

interface ClientesState {
  clientes: Cliente[];
  loading: boolean;
  fetchClientes: () => Promise<void>;
  addCliente: (data: {
    nome: string;
    responsavelId?: string | null;
    telefoneWhatsapp?: string | null;
    roteirosPorSemana?: number | null;
    reunioesPorMes?: number | null;
  }) => Promise<{ success: boolean; error?: string }>;
  updateCliente: (
    id: string,
    data: Partial<{
      nome: string;
      responsavelId: string | null;
      telefoneWhatsapp: string | null;
      roteirosPorSemana: number | null;
      reunioesPorMes: number | null;
      ativo: boolean;
    }>
  ) => Promise<{ success: boolean; error?: string }>;
  removeCliente: (id: string) => Promise<void>;
}

export const useClientesStore = create<ClientesState>()((set) => ({
  clientes: [],
  loading: false,

  fetchClientes: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (data.clientes) {
        set({ clientes: data.clientes });
      }
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    } finally {
      set({ loading: false });
    }
  },

  addCliente: async (clienteData) => {
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clienteData),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Erro ao criar cliente." };
      }
      set((state) => ({ clientes: [...state.clientes, data.cliente].sort((a, b) => a.nome.localeCompare(b.nome)) }));
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },

  updateCliente: async (id, data) => {
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || "Erro ao atualizar cliente." };
      }
      set((state) => ({
        clientes: state.clientes.map((c) => (c.id === id ? result.cliente : c)),
      }));
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão com o servidor." };
    }
  },

  removeCliente: async (id) => {
    try {
      await fetch(`/api/clientes/${id}`, { method: "DELETE" });
      set((state) => ({
        clientes: state.clientes.filter((c) => c.id !== id),
      }));
    } catch (error) {
      console.error("Erro ao remover cliente:", error);
    }
  },
}));
