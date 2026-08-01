// ============================================
// TYPES - Doctor Creator Ops
// ============================================

export type UserRole = "master" | "team";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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

export interface ReuniaoValidation {
  status: ReuniaoStatus;
  score: number;
  issues: ReuniaoIssue[];
  wordCount: number;
  estimatedDurationMinutes: number;
  suggestedAgenda: string[];
}

export interface Reuniao {
  id: string;
  authorId: string;
  authorName: string;
  clientName: string;
  tipo: ReuniaoTipo;
  content: string;
  status: ReuniaoStatus;
  score: number;
  issues: ReuniaoIssue[];
  suggestedAgenda: string[];
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ============================================
// VISÃO GERAL — lê o pipeline externo de validação
// (tabelas reuniao_validacoes / conteudo_validacoes)
// ============================================

// Tier visual simplificado (✅ / ⚠️ / ❌), derivado do texto livre de
// `status` que o pipeline externo grava — não é um enum fechado no banco.
export type StatusTier = "ok" | "atencao" | "critico";

export interface RiscoItem {
  descricao: string;
  responsavel: string | null;
}

export interface CompromissoItem {
  descricao: string;
  responsavel: string | null;
  prazo: string | null;
}

export interface ReuniaoValidacaoRow {
  id: string;
  arquivoNome: string | null;
  cliente: string;
  status: string;
  statusTier: StatusTier;
  resumo: string | null;
  compromissos: CompromissoItem[];
  riscos: RiscoItem[];
  pautaProxima: string | null;
  recapMensagem: string | null;
  createdAt: string;
}

export interface ConteudoValidacaoRow {
  id: string;
  pecaNome: string | null;
  cliente: string;
  tipo: string;
  statusTexto: string | null;
  statusArte: string | null;
  statusTier: StatusTier;
  feedback: string | null;
  createdAt: string;
}

export interface ClienteOverviewRow {
  cliente: string;
  ultimaReuniao: { data: string; status: string; statusTier: StatusTier } | null;
  ultimoConteudo: { data: string; status: string; statusTier: StatusTier } | null;
  riscosAbertos: number;
}

export interface RiscoAberto {
  cliente: string;
  descricao: string;
  createdAt: string;
}

export interface DashboardAlerts {
  reunioesIncompletas: ReuniaoValidacaoRow[];
  riscosAbertos: RiscoAberto[];
  conteudoReprovado: ConteudoValidacaoRow[];
}

export type FeedItem =
  | { type: "reuniao"; data: ReuniaoValidacaoRow }
  | { type: "conteudo"; data: ConteudoValidacaoRow };

export interface DashboardOverview {
  clientes: ClienteOverviewRow[];
  alerts: DashboardAlerts;
  feed: FeedItem[];
}
