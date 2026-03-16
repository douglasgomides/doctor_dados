import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardVersion = "v1" | "v2";

interface UIState {
  version: DashboardVersion;
  setVersion: (v: DashboardVersion) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      version: "v1",
      setVersion: (version) => set({ version }),
    }),
    { name: "dashboard-ui" }
  )
);
