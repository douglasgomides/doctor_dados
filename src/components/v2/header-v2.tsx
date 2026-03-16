"use client";

import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore } from "@/store/dashboard-store";
import { MOCK_AD_ACCOUNTS } from "@/lib/mock-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionToggle } from "@/components/version-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Search, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function HeaderV2() {
  const user = useAuthStore((s) => s.user);
  const filters = useDashboardStore((s) => s.filters);
  const setFilters = useDashboardStore((s) => s.setFilters);

  if (!user) return null;

  return (
    <header className="h-14 border-b border-border/30 bg-background/60 backdrop-blur-xl flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumb-style title */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">DC Analytics</h2>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground">Dashboard</span>
        </div>

        {/* Account selector - Master only */}
        {user.role === "master" && (
          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-border/30">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Select
              value={filters.adAccount}
              onValueChange={(value) => setFilters({ adAccount: value })}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs border-border/40 bg-muted/30">
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

        {user.role === "client" && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            {user.accountName}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="h-8 w-[200px] pl-8 text-xs border-border/40 bg-muted/30"
          />
        </div>

        <VersionToggle />

        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-violet-500 rounded-full ring-2 ring-background" />
        </Button>

        <ThemeToggle />
      </div>
    </header>
  );
}
