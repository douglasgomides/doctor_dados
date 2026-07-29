import { create } from "zustand";
import { CampaignRow, DashboardFilters } from "@/types";

interface DashboardState {
  data: CampaignRow[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  filters: DashboardFilters;
  fetchData: () => Promise<void>;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  updateRow: (rowIndex: number, field: keyof CampaignRow, value: string | number) => void;
  getFilteredData: (accountFilter?: string) => CampaignRow[];
  getPreviousPeriodData: (accountFilter?: string) => CampaignRow[];
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  data: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  filters: {
    dateFrom: undefined,
    dateTo: undefined,
    campaign: "all",
    adAccount: "all",
  },

  fetchData: async () => {
    // Evita fetch duplicado se já está carregando
    if (get().isLoading) return;

    // Cache de 5 minutos
    const now = Date.now();
    const last = get().lastFetched;
    if (last && now - last < 5 * 60 * 1000 && get().data.length > 0) return;

    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/campaigns");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ao buscar dados (${res.status})`);
      }
      const { data } = await res.json();
      set({ data, isLoading: false, lastFetched: Date.now() });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Erro ao carregar dados",
        isLoading: false,
      });
    }
  },

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  updateRow: (rowIndex, field, value) =>
    set((state) => ({
      data: state.data.map((row) =>
        row.rowIndex === rowIndex ? { ...row, [field]: value } : row
      ),
    })),

  getFilteredData: (accountFilter?: string) => {
    const { data, filters } = get();
    return filterRows(data, filters, accountFilter);
  },

  // Dados do período imediatamente anterior, de mesma duração, para comparação
  // real de tendência (% de variação) nos KPIs de inteligência comercial.
  getPreviousPeriodData: (accountFilter?: string) => {
    const { data, filters } = get();

    let dateFrom = filters.dateFrom;
    let dateTo = filters.dateTo;

    if (!dateFrom || !dateTo) {
      // Sem filtro de data explícito: usa os dias disponíveis nos dados
      // (já filtrados por conta/campanha) e divide ao meio.
      const scoped = filterRows(data, { ...filters, dateFrom: undefined, dateTo: undefined }, accountFilter);
      const days = [...new Set(scoped.map((r) => r.dia))].sort();
      if (days.length < 2) return [];
      const mid = Math.floor(days.length / 2);
      dateFrom = new Date(days[0]);
      dateTo = new Date(days[mid - 1]);
    }

    const periodMs = dateTo.getTime() - dateFrom.getTime();
    const prevDateTo = new Date(dateFrom.getTime() - 24 * 60 * 60 * 1000);
    const prevDateFrom = new Date(prevDateTo.getTime() - periodMs);

    return filterRows(
      data,
      { ...filters, dateFrom: prevDateFrom, dateTo: prevDateTo },
      accountFilter
    );
  },
}));

function filterRows(
  data: CampaignRow[],
  filters: DashboardFilters,
  accountFilter?: string
): CampaignRow[] {
  return data.filter((row) => {
    // Filtro de conta de anúncio (do seletor global ou da conta do cliente)
    const effectiveAccount = accountFilter || filters.adAccount;
    if (effectiveAccount && effectiveAccount !== "all") {
      if (row.contaDeAnuncio !== effectiveAccount) return false;
    }

    // Filtro de data
    if (filters.dateFrom) {
      const rowDate = new Date(row.dia);
      if (rowDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const rowDate = new Date(row.dia);
      if (rowDate > filters.dateTo) return false;
    }

    // Filtro de campanha
    if (filters.campaign && filters.campaign !== "all") {
      if (row.nomeDaCampanha !== filters.campaign) return false;
    }

    return true;
  });
}
