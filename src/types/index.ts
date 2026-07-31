// ============================================
// TYPES - Dashboard SaaS Multi-Tenant
// ============================================

export type UserRole = "master" | "client" | "team";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountId: string; // ID da Conta de Anúncio vinculada (para clientes)
  accountName: string;
}

export interface AdAccount {
  id: string;
  name: string;
}

export interface CampaignRow {
  rowIndex: number; // Índice da linha no Google Sheets
  dia: string;
  status: string;
  acoes: string;
  contaDeAnuncio: string;
  nomeDaCampanha: string;
  linkDoPost: string;
  tipo: string;
  orcamento: number;
  valorInvestido: number;
  seguidoresNovos: number;
  custoPorSeguidor: number;
  mensagensIniciadas: number;
  custoPorMensagem: number;
  impressoes: number;
  alcance: number;
  cliquesNoLink: number;
  cliquesUnicos: number;
  visualizacaoDaPagina: number;
  checkouts: number;
}

// Colunas que podem ser editadas pelo usuário
export const EDITABLE_COLUMNS: (keyof CampaignRow)[] = [
  "status",
  "acoes",
  "linkDoPost",
  "tipo",
  "orcamento",
  "seguidoresNovos",
  "custoPorSeguidor",
  "mensagensIniciadas",
  "custoPorMensagem",
  "visualizacaoDaPagina",
  "checkouts",
];

// Colunas somente leitura
export const READONLY_COLUMNS: (keyof CampaignRow)[] = [
  "dia",
  "contaDeAnuncio",
  "nomeDaCampanha",
  "valorInvestido",
  "impressoes",
  "alcance",
  "cliquesNoLink",
  "cliquesUnicos",
];

// Labels amigáveis para as colunas
export const COLUMN_LABELS: Record<keyof CampaignRow, string> = {
  rowIndex: "#",
  dia: "Dia",
  status: "Status",
  acoes: "Ações",
  contaDeAnuncio: "Conta de Anúncio",
  nomeDaCampanha: "Nome da Campanha",
  linkDoPost: "Link do Post",
  tipo: "Tipo",
  orcamento: "Orçamento",
  valorInvestido: "Valor Investido",
  seguidoresNovos: "Seguidores Novos",
  custoPorSeguidor: "Custo por Seguidor",
  mensagensIniciadas: "Mensagens Iniciadas",
  custoPorMensagem: "Custo por Mensagem",
  impressoes: "Impressões",
  alcance: "Alcance",
  cliquesNoLink: "Cliques no Link",
  cliquesUnicos: "Cliques Únicos",
  visualizacaoDaPagina: "Visualização da Página",
  checkouts: "Checkouts",
};

export interface DashboardFilters {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  campaign: string;
  adAccount: string;
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
