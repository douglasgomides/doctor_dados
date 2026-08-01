import { StatusTier } from "@/types";

// O pipeline externo grava `status` como texto livre (ex: "ok", "incompleto",
// "completo", "reprovado"), não um enum fixo no banco. Mapeamos por
// palavra-chave para o tier visual (✅/⚠️/❌) em vez de comparar string exata,
// pra não quebrar se o pipeline usar uma variação do termo.
const CRITICO_HINTS = ["reprovad", "critic", "erro", "falh"];
const ATENCAO_HINTS = ["incomplet", "ajust", "atenc", "alerta", "pendente", "revis"];

export function statusToTier(status: string | null | undefined): StatusTier {
  const normalized = (status || "").toLowerCase();
  if (CRITICO_HINTS.some((hint) => normalized.includes(hint))) return "critico";
  if (ATENCAO_HINTS.some((hint) => normalized.includes(hint))) return "atencao";
  if (!normalized) return "atencao";
  return "ok";
}

export const STATUS_TIER_EMOJI: Record<StatusTier, string> = {
  ok: "✅",
  atencao: "⚠️",
  critico: "❌",
};
