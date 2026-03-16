"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { FiltersV2 } from "@/components/v2/filters-v2";
import { KPICardsV2 } from "@/components/v2/kpi-cards-v2";
import { ChartsV2 } from "@/components/v2/charts-v2";
import { DataTableV2 } from "@/components/v2/data-table-v2";
import { Activity, Loader2 } from "lucide-react";

export function DashboardV2() {
  const user = useAuthStore((s) => s.user);
  const getFilteredData = useDashboardStore((s) => s.getFilteredData);
  const fetchData = useDashboardStore((s) => s.fetchData);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isClient = user?.role === "client";
  const accountFilter = isClient ? user.accountName : undefined;
  const filteredData = getFilteredData(accountFilter);

  if (isLoading && filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Carregando dados da planilha...</span>
      </div>
    );
  }

  if (error && filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1600px] mx-auto">
      {/* Header Row */}
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <Activity className="h-3 w-3" />
              Live
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              Atualizado agora
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {user?.role === "master"
              ? "Visão Geral"
              : user?.accountName}
          </h1>
        </div>
        <FiltersV2 />
      </div>

      {/* KPIs */}
      <KPICardsV2 data={filteredData} />

      {/* Charts */}
      <ChartsV2 data={filteredData} />

      {/* Table */}
      <div className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold">Dados Detalhados</h3>
            <p className="text-[11px] text-muted-foreground">
              {isClient
                ? "Visualização somente leitura dos dados da sua conta."
                : <>Duplo clique nas colunas em{" "}<span className="text-violet-500 font-medium">roxo</span> para editar inline</>}
            </p>
          </div>
        </div>
        <DataTableV2 data={filteredData} readOnly={isClient} />
      </div>
    </div>
  );
}
