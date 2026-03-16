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
import { CalendarIcon, RotateCcw, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function FiltersV2() {
  const filters = useDashboardStore((s) => s.filters);
  const setFilters = useDashboardStore((s) => s.setFilters);

  const data = useDashboardStore((s) => s.data);
  const campaigns = [...new Set(data.map((r) => r.nomeDaCampanha))];

  const hasFilters =
    filters.dateFrom || filters.dateTo || filters.campaign !== "all";

  const activeCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.campaign !== "all" ? filters.campaign : null,
  ].filter(Boolean).length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 mr-1">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Filtros</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-violet-600 text-[9px] text-white font-bold">
            {activeCount}
          </span>
        )}
      </div>

      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs border-border/40 bg-muted/30 gap-1.5",
              filters.dateFrom && "border-violet-500/50 bg-violet-500/5"
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {filters.dateFrom
              ? format(filters.dateFrom, "dd MMM", { locale: ptBR })
              : "Início"}
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

      <span className="text-muted-foreground/40 text-xs">—</span>

      {/* Date To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs border-border/40 bg-muted/30 gap-1.5",
              filters.dateTo && "border-violet-500/50 bg-violet-500/5"
            )}
          >
            <CalendarIcon className="h-3 w-3" />
            {filters.dateTo
              ? format(filters.dateTo, "dd MMM", { locale: ptBR })
              : "Fim"}
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

      {/* Campaign */}
      <Select
        value={filters.campaign}
        onValueChange={(value) => setFilters({ campaign: value })}
      >
        <SelectTrigger
          className={cn(
            "h-8 w-[200px] text-xs border-border/40 bg-muted/30",
            filters.campaign !== "all" && "border-violet-500/50 bg-violet-500/5"
          )}
        >
          <SelectValue placeholder="Campanha" />
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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground gap-1"
          onClick={() =>
            setFilters({ dateFrom: undefined, dateTo: undefined, campaign: "all" })
          }
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </Button>
      )}
    </div>
  );
}
