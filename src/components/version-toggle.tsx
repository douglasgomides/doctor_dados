"use client";

import { useUIStore, DashboardVersion } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";

export function VersionToggle() {
  const version = useUIStore((s) => s.version);
  const setVersion = useUIStore((s) => s.setVersion);

  return (
    <div className="flex items-center gap-2">
      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
        {(["v1", "v2"] as DashboardVersion[]).map((v) => (
          <button
            key={v}
            onClick={() => setVersion(v)}
            className={cn(
              "px-3 py-1 text-xs font-semibold rounded-md transition-all uppercase tracking-wider",
              version === v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
