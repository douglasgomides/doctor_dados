"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import {
  BarChart3,
  LayoutDashboard,
  Table2,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { UserRole } from "@/types";

const clientNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Campanhas", href: "/dashboard/campaigns", icon: Table2 },
  { name: "Configurações", href: "/dashboard/settings", icon: Settings },
];

const teamNavigation = [
  { name: "Roteiros", href: "/dashboard/roteiros", icon: ClipboardCheck },
  { name: "Configurações", href: "/dashboard/settings", icon: Settings },
];

const masterNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Campanhas", href: "/dashboard/campaigns", icon: Table2 },
  { name: "Roteiros", href: "/dashboard/roteiros", icon: ClipboardCheck },
  { name: "Usuários", href: "/dashboard/users", icon: Users },
  { name: "Configurações", href: "/dashboard/settings", icon: Settings },
];

function getNavigation(role: UserRole) {
  if (role === "master") return masterNavigation;
  if (role === "team") return teamNavigation;
  return clientNavigation;
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
        "flex flex-col h-screen border-r border-border/50 bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border/50">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shrink-0">
          <BarChart3 className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate">DC Analytics</span>
            <span className="text-[10px] text-muted-foreground truncate">
              Meta Ads Dashboard
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {getNavigation(user.role).map((item) => {
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
                  {user.role === "master" ? "Master" : user.role === "team" ? "Equipe" : "Cliente"}
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
