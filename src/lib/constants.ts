// Limiar (em horas) a partir do qual um item pendente de revisão é tratado
// como urgente — usado tanto no alerta diário de WhatsApp
// (src/app/api/automations/alerts/route.ts) quanto nas tabelas de
// Roteiros/Reuniões dentro do próprio app, pra esse sinal não ficar restrito
// à mensagem que só chega às 9h.
export const URGENTE_HORAS = 48;

export function horasDesde(dataIso: string): number {
  return (Date.now() - new Date(dataIso).getTime()) / (1000 * 60 * 60);
}
