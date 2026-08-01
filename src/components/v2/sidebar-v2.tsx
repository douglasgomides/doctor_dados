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
  Users,
  ClipboardCheck,
  Users2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { UserRole } from "@/types";

const PERFORMANCE_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Campanhas", href: "/dashboard/campaigns", icon: Table2 },
];

const QUALIDADE_ITEMS = [
  { name: "Roteiros", href: "/dashboard/roteiros", icon: ClipboardCheck },
  { name: "Reuniões", href: "/dashboard/reunioes", icon: Users2 },
];

const ADMIN_ITEMS = [{ name: "Usuários", href: "/dashboard/users", icon: Users }];

const GERAL_ITEMS = [{ name: "Configurações", href: "/dashboard/settings", icon: Settings }];

function getNavigationGroups(role: UserRole) {
  if (role === "master") {
    return [PERFORMANCE_ITEMS, QUALIDADE_ITEMS, [...ADMIN_ITEMS, ...GERAL_ITEMS]];
  }
  if (role === "team") {
    return [QUALIDADE_ITEMS, GERAL_ITEMS];
  }
  return [PERFORMANCE_ITEMS, GERAL_ITEMS];
}

export function SidebarV2() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <aside className="flex flex-col items-center w-[72px] h-screen border-r border-border/30 bg-sidebar py-4 gap-1">
      {/* Logo */}
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white mb-4 shadow-lg shadow-violet-600/20">
        <BarChart3 className="h-5 w-5" />
      </div>

      <Separator className="w-8 mb-3 opacity-50" />

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-1 flex-1">
        {getNavigationGroups(user.role).map((group, groupIndex) => (
          <div key={groupIndex} className="flex flex-col items-center gap-1">
            {groupIndex > 0 && <Separator className="w-8 my-1.5 opacity-50" />}
            {group.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Tooltip key={item.name} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-br from-violet-600/10 to-indigo-600/10 text-violet-600 dark:text-violet-400 shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[18px] w-1 h-5 rounded-r-full bg-gradient-to-b from-violet-600 to-indigo-600" />
                      )}
                      <item.icon className="h-[18px] w-[18px]" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <Separator className="w-8 mb-3 opacity-50" />

      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all mb-2"
          >
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Sair
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="cursor-default">
            <Avatar className="h-9 w-9 ring-2 ring-violet-600/20">
              <AvatarFallback className="text-[10px] font-bold bg-gradient-to-br from-violet-600/10 to-indigo-600/10 text-violet-600 dark:text-violet-400">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
