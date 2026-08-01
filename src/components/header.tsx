"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { MOCK_AD_ACCOUNTS } from "@/lib/mock-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionToggle } from "@/components/version-toggle";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Building2 } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/visao-geral": "Visão Geral",
  "/dashboard": "Dashboard",
  "/dashboard/campaigns": "Campanhas",
  "/dashboard/roteiros": "Roteiros",
  "/dashboard/reunioes": "Reuniões",
  "/dashboard/users": "Usuários",
  "/dashboard/settings": "Configurações",
};

export function Header() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const filters = useDashboardStore((s) => s.filters);
  const setFilters = useDashboardStore((s) => s.setFilters);

  if (!user) return null;

  return (
    <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold">{PAGE_TITLES[pathname] || "Dashboard"}</h2>

        {/* Seletor de Conta de Anúncio - Apenas para Master */}
        {user.role === "master" && (
          <div className="flex items-center gap-2 ml-4">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filters.adAccount}
              onValueChange={(value) => setFilters({ adAccount: value })}
            >
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue placeholder="Todas as Contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Contas</SelectItem>
                {MOCK_AD_ACCOUNTS.map((account) => (
                  <SelectItem key={account.id} value={account.name}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <VersionToggle />
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-destructive rounded-full" />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
