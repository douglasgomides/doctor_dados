import { create } from "zustand";
import { User } from "@/types";

interface UsersState {
  users: User[];
  loading: boolean;
  fetchUsers: () => Promise<void>;
  addUser: (user: Omit<User, "id"> & { password?: string }) => Promise<void>;
  updateUser: (id: string, data: Partial<User> & { password?: string }) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
}

export const useUsersStore = create<UsersState>()((set) => ({
  users: [],
  loading: false,

  fetchUsers: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.users) {
        set({ users: data.users });
      }
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
    } finally {
      set({ loading: false });
    }
  },

  addUser: async (userData) => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      const data = await res.json();
      if (data.user) {
        set((state) => ({ users: [...state.users, data.user] }));
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
    }
  },

  updateUser: async (id, data) => {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.user) {
        set((state) => ({
          users: state.users.map((u) => (u.id === id ? result.user : u)),
        }));
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
    }
  },

  removeUser: async (id) => {
    try {
      await fetch(`/api/users/${id}`, { method: "DELETE" });
      set((state) => ({
        users: state.users.filter((u) => u.id !== id),
      }));
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
    }
  },
}));
