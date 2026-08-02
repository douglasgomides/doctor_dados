import { StatusTier } from "@/types";

// Deriva o tier visual (✅/⚠️/❌) do status + nota da IA. "Aprovado" é
// sempre ok; "ajustar" vira crítico quando a nota está muito baixa (poucos
// pontos ganhos, provavelmente erro bloqueante) e atenção nos demais casos.
export function scoreToTier(status: "aprovado" | "ajustar", score: number): StatusTier {
  if (status === "aprovado") return "ok";
  return score < 50 ? "critico" : "atencao";
}

export const STATUS_TIER_EMOJI: Record<StatusTier, string> = {
  ok: "✅",
  atencao: "⚠️",
  critico: "❌",
};
