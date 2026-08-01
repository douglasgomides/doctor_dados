"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";

// /dashboard sozinho não tem mais tela própria — cada papel tem sua home
// (master → Visão Geral, equipe → Roteiros). Esta rota só existe como
// destino de fallback (ex: link antigo, digitação manual da URL).
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (user?.role === "team") {
      router.replace("/dashboard/roteiros");
    } else {
      router.replace("/dashboard/visao-geral");
    }
  }, [user?.role, router]);

  return null;
}
