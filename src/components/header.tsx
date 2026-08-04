"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { usePendenciasStore } from "@/store/pendencias-store";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/visao-geral": "Visão Geral",
  "/dashboard/pendencias": "Central de Pendências",
  "/dashboard/performance": "Performance",
  "/dashboard/comercial": "Comercial",
  "/dashboard/comercial/insights": "Relatório de padrões",
  "/dashboard/roteiros": "Roteiros",
  "/dashboard/reunioes": "Reuniões",
  "/dashboard/clientes": "Clientes",
  "/dashboard/users": "Usuários",
  "/dashboard/settings": "Configurações",
  "/dashboard/carousel-tool": "Clonador de Carrossel",
};

export function Header() {
  const user = useAuthStore((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const pendencias = usePendenciasStore((s) => s.pendencias);
  const fetchPendencias = usePendenciasStore((s) => s.fetchPendencias);

  useEffect(() => {
    if (user?.role !== "master") return;
    fetchPendencias();
  }, [user?.role, fetchPendencias]);

  if (!user) return null;

  const count = pendencias.length;
  const urgente = pendencias.some((p) => p.urgente);

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold font-heading">
        {PAGE_TITLES[pathname] || "Doctor Creator Ops"}
      </h2>

      <div className="flex items-center gap-2">
        {user.role === "master" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative text-muted-foreground hover:text-primary"
            onClick={() => router.push("/dashboard/pendencias")}
            title={count > 0 ? `${count} pendência${count !== 1 ? "s" : ""}` : "Sem pendências"}
          >
            <Bell className="h-4 w-4" />
            {count > 0 && (
              <span
                className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                  urgente ? "bg-destructive" : "bg-primary"
                }`}
              />
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
