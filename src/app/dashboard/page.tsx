"use client";

import { useEffect } from "react";
import { useUIStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { DashboardFilters } from "@/components/dashboard/filters";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { Charts } from "@/components/dashboard/charts";
import { ConversionFunnel } from "@/components/dashboard/conversion-funnel";
import { CampaignRanking } from "@/components/dashboard/campaign-ranking";
import { DataTable } from "@/components/dashboard/data-table";
import { DashboardV2 } from "@/components/v2/dashboard-v2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table2, Loader2 } from "lucide-react";

export default function DashboardPage() {
  const version = useUIStore((s) => s.version);
  const user = useAuthStore((s) => s.user);
  const getFilteredData = useDashboardStore((s) => s.getFilteredData);
  const getPreviousPeriodData = useDashboardStore((s) => s.getPreviousPeriodData);
  const fetchData = useDashboardStore((s) => s.fetchData);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const error = useDashboardStore((s) => s.error);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (version === "v2") {
    return <DashboardV2 />;
  }

  // V1
  const isClient = user?.role === "client";
  const accountFilter = isClient ? user.accountName : undefined;
  const filteredData = getFilteredData(accountFilter);
  const previousData = getPreviousPeriodData(accountFilter);

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
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Olá, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {user?.role === "master"
            ? "Visão geral de todas as contas de anúncio"
            : `Métricas da conta: ${user?.accountName}`}
        </p>
      </div>

      <DashboardFilters />
      <KPICards data={filteredData} previousData={previousData} />
      <ConversionFunnel data={filteredData} />
      <Charts data={filteredData} />
      <CampaignRanking data={filteredData} />

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">
              Dados Detalhados
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {isClient
              ? "Visualização somente leitura dos dados da sua conta."
              : "Clique duas vezes em uma célula editável para alterar o valor, ou use o botão de edição para abrir o formulário completo."}
          </p>
        </CardHeader>
        <CardContent>
          <DataTable data={filteredData} readOnly={isClient} />
        </CardContent>
      </Card>
    </div>
  );
}
