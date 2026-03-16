"use client";

import { useDashboardStore } from "@/store/dashboard-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function DashboardFilters() {
  const filters = useDashboardStore((s) => s.filters);
  const setFilters = useDashboardStore((s) => s.setFilters);

  const data = useDashboardStore((s) => s.data);
  const campaigns = [...new Set(data.map((r) => r.nomeDaCampanha))];

  const hasFilters =
    filters.dateFrom || filters.dateTo || filters.campaign !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 justify-start text-left font-normal w-[170px]",
              !filters.dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateFrom
              ? format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR })
              : "Data inicial"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateFrom}
            onSelect={(date) => setFilters({ dateFrom: date })}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {/* Date To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-9 justify-start text-left font-normal w-[170px]",
              !filters.dateTo && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateTo
              ? format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR })
              : "Data final"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={filters.dateTo}
            onSelect={(date) => setFilters({ dateTo: date })}
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>

      {/* Campaign Filter */}
      <Select
        value={filters.campaign}
        onValueChange={(value) => setFilters({ campaign: value })}
      >
        <SelectTrigger className="h-9 w-[240px]">
          <SelectValue placeholder="Todas as Campanhas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as Campanhas</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground"
          onClick={() =>
            setFilters({
              dateFrom: undefined,
              dateTo: undefined,
              campaign: "all",
            })
          }
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
