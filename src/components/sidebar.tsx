"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import {
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  ClipboardCheck,
  Users2,
  Sparkles,
  Contact,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { UserRole } from "@/types";

const VISAO_GERAL_ITEMS = [
  { name: "Visão Geral", href: "/dashboard/visao-geral", icon: Sparkles },
  { name: "Performance", href: "/dashboard/performance", icon: TrendingUp },
];

const QUALIDADE_ITEMS = [
  { name: "Roteiros", href: "/dashboard/roteiros", icon: ClipboardCheck },
  { name: "Reuniões", href: "/dashboard/reunioes", icon: Users2 },
];

const ADMIN_ITEMS = [
  { name: "Clientes", href: "/dashboard/clientes", icon: Contact },
  { name: "Usuários", href: "/dashboard/users", icon: Users },
];

const GERAL_ITEMS = [{ name: "Configurações", href: "/dashboard/settings", icon: Settings }];

function getNavigationGroups(role: UserRole) {
  if (role === "master") {
    return [
      { label: "Visão Geral", items: VISAO_GERAL_ITEMS },
      { label: "Qualidade", items: QUALIDADE_ITEMS },
      { label: "Admin", items: [...ADMIN_ITEMS, ...GERAL_ITEMS] },
    ];
  }
  return [
    { label: "Qualidade", items: QUALIDADE_ITEMS },
    { label: "Geral", items: GERAL_ITEMS },
  ];
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[#F0D97D] via-[#D0A465] to-[#9C7A1E] shrink-0">
          <span className="text-black font-bold text-sm font-heading">DC</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate font-heading">Doctor Creator Ops</span>
            <span className="text-[10px] text-muted-foreground truncate">
              Central da agência
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {getNavigationGroups(user.role).map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <span className="block px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </span>
            )}
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 pb-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span className="text-xs">Recolher</span>
            </>
          )}
        </Button>
      </div>

      <Separator />

      {/* User section */}
      <div className="px-3 py-3">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-sm font-medium truncate">{user.name}</span>
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={user.role === "master" ? "default" : "secondary"}
                  className="text-[9px] px-1.5 py-0 h-4"
                >
                  {user.role === "master" ? "Master" : "Equipe"}
                </Badge>
              </div>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
