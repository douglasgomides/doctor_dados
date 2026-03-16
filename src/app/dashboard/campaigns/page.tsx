"use client";

import { useUIStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { DashboardFilters } from "@/components/dashboard/filters";
import { FiltersV2 } from "@/components/v2/filters-v2";
import { DataTable } from "@/components/dashboard/data-table";
import { DataTableV2 } from "@/components/v2/data-table-v2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table2 } from "lucide-react";

export default function CampaignsPage() {
  const version = useUIStore((s) => s.version);
  const user = useAuthStore((s) => s.user);
  const getFilteredData = useDashboardStore((s) => s.getFilteredData);

  const accountFilter = user?.role === "client" ? user.accountName : undefined;
  const filteredData = getFilteredData(accountFilter);

  if (version === "v2") {
    return (
      <div className="space-y-5 max-w-[1600px] mx-auto">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Campanhas</h1>
            <p className="text-[11px] text-muted-foreground">
              Gerencie e edite os dados das suas campanhas
            </p>
          </div>
          <FiltersV2 />
        </div>

        <div className="rounded-xl border border-border/40 bg-card/80 backdrop-blur-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold">Todas as Campanhas</h3>
              <p className="text-[11px] text-muted-foreground">
                Duplo clique nas colunas em{" "}
                <span className="text-violet-500 font-medium">roxo</span> para
                editar
              </p>
            </div>
          </div>
          <DataTableV2 data={filteredData} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie e edite os dados das suas campanhas
        </p>
      </div>

      <DashboardFilters />

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">
              Todas as Campanhas
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Clique duas vezes em uma célula editável para alterar o valor
            diretamente na tabela.
          </p>
        </CardHeader>
        <CardContent>
          <DataTable data={filteredData} />
        </CardContent>
      </Card>
    </div>
  );
}
