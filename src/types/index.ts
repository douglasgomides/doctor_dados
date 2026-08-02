// ============================================
// TYPES - Doctor Creator Ops
// ============================================

export type UserRole = "master" | "team";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  telefoneWhatsapp: string | null;
}

// ============================================
// VALIDADOR DE QUALIDADE DE ROTEIROS
// ============================================

export type RoteiroFormat = "reel" | "carrossel" | "stories";

export const ROTEIRO_FORMAT_LABELS: Record<RoteiroFormat, string> = {
  reel: "Reels",
  carrossel: "Carrossel",
  stories: "Stories",
};

export type RoteiroStatus = "aprovado" | "ajustar";

export type RoteiroIssueSeverity = "erro" | "alerta";

export interface RoteiroIssue {
  severity: RoteiroIssueSeverity;
  rule: string;
  message: string;
}

export interface RoteiroValidation {
  status: RoteiroStatus;
  score: number;
  issues: RoteiroIssue[];
  wordCount: number;
  readingTimeSeconds: number | null;
}

export interface Roteiro {
  id: string;
  authorId: string;
  authorName: string;
  clientId: string | null;
  clientName: string;
  format: RoteiroFormat;
  title: string;
  content: string;
  status: RoteiroStatus;
  score: number;
  issues: RoteiroIssue[];
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ============================================
// VALIDADOR DE QUALIDADE DE REUNIÕES
// ============================================

export type ReuniaoTipo = "mentoria" | "grupo" | "onboarding" | "pontual";

export const REUNIAO_TIPO_LABELS: Record<ReuniaoTipo, string> = {
  mentoria: "Mentoria (mensal/quinzenal)",
  grupo: "Reunião em grupo",
  onboarding: "Onboarding",
  pontual: "Pontual / Emergencial",
};

export type ReuniaoStatus = "aprovado" | "ajustar";

export interface ReuniaoIssue {
  severity: RoteiroIssueSeverity;
  rule: string;
  message: string;
}

export interface ContentIdea {
  format: RoteiroFormat;
  tema: string;
}

export interface ReuniaoValidation {
  status: ReuniaoStatus;
  score: number;
  issues: ReuniaoIssue[];
  wordCount: number;
  estimatedDurationMinutes: number;
  suggestedAgenda: string[];
  suggestedContentIdeas: ContentIdea[];
}

export interface Reuniao {
  id: string;
  authorId: string;
  authorName: string;
  clientId: string | null;
  clientName: string;
  tipo: ReuniaoTipo;
  content: string;
  status: ReuniaoStatus;
  score: number;
  issues: ReuniaoIssue[];
  suggestedAgenda: string[];
  suggestedContentIdeas: ContentIdea[];
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ============================================
// CLIENTES — cadastro dos médicos atendidos, com responsável da
// equipe e metas de cadência (base para automatizar cobrança/follow-up)
// ============================================

export interface Cliente {
  id: string;
  nome: string;
  responsavelId: string | null;
  responsavelName: string | null;
  telefoneWhatsapp: string | null;
  roteirosPorSemana: number | null;
  reunioesPorMes: number | null;
  ativo: boolean;
  createdAt: string;
}

// ============================================
// VISÃO GERAL — agrega os próprios roteiros e reuniões
// validados por IA neste app (nenhuma dependência externa)
// ============================================

// Tier visual simplificado (✅ / ⚠️ / ❌) derivado do status + nota da IA.
export type StatusTier = "ok" | "atencao" | "critico";

export interface ClienteOverviewRow {
  cliente: string;
  responsavelName: string | null;
  ultimoRoteiro: { data: string; status: RoteiroStatus; statusTier: StatusTier; score: number } | null;
  ultimaReuniao: { data: string; status: ReuniaoStatus; statusTier: StatusTier; score: number } | null;
  pendentesAjuste: number;
}

export interface DashboardAlerts {
  roteirosParaAjustar: Roteiro[];
  reunioesParaAjustar: Reuniao[];
}

export type FeedItem =
  | { type: "roteiro"; data: Roteiro }
  | { type: "reuniao"; data: Reuniao };

export interface DashboardOverview {
  clientes: ClienteOverviewRow[];
  alerts: DashboardAlerts;
  feed: FeedItem[];
}
