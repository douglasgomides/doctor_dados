"use client";

import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/visao-geral": "Visão Geral",
  "/dashboard/roteiros": "Roteiros",
  "/dashboard/reunioes": "Reuniões",
  "/dashboard/clientes": "Clientes",
  "/dashboard/users": "Usuários",
  "/dashboard/settings": "Configurações",
};

export function Header() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();

  if (!user) return null;

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold font-heading">
        {PAGE_TITLES[pathname] || "Doctor Creator Ops"}
      </h2>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 relative text-muted-foreground hover:text-primary">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
        </Button>
      </div>
    </header>
  );
}
