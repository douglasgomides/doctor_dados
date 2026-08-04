import { z } from "zod";

/**
 * Campos de paginação reutilizados por todas as ferramentas de listagem.
 * `fetchAllPages` percorre automaticamente todas as páginas disponíveis
 * (até o limite de segurança interno) e devolve a lista completa.
 */
export const paginationShape = {
  page: z.number().int().min(1).optional().describe("Página a buscar (1-based). Padrão: 1. Ignorado se fetchAllPages=true."),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe("Quantidade de itens por página. Padrão: 50."),
  fetchAllPages: z
    .boolean()
    .optional()
    .describe(
      "Se true, busca automaticamente todas as páginas disponíveis e devolve a lista completa, em vez de apenas uma página."
    ),
};

export type PaginationArgs = {
  page?: number;
  perPage?: number;
  fetchAllPages?: boolean;
};

/** Aceita tanto uma tag única quanto uma lista de tags. */
export const tagsFilterSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .describe("Filtra por uma tag (string) ou várias (array de strings).");

export function toTagsArray(tags: string | string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  return Array.isArray(tags) ? tags : [tags];
}

/** JSON genérico usado para campos personalizados (fields) de contatos e negócios. */
export const customFieldsSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe("Campos personalizados, como um objeto chave/valor (ex.: { \"cidade\": \"Curitiba\" }).");
