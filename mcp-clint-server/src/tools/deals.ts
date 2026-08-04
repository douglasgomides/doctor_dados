import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ClintClient } from "../client.js";
import { paginatedList } from "../pagination.js";
import { paginationShape, tagsFilterSchema, toTagsArray, customFieldsSchema } from "../types.js";
import { textResult, jsonBlock, formatValue, safeHandler } from "../format.js";

const listDealsShape = {
  status: z.string().optional().describe('Filtra pelo status do negócio (ex.: "open", "won", "lost").'),
  stage: z.string().optional().describe("Filtra pela etapa do funil (ID da etapa)."),
  origin: z.string().optional().describe("Filtra pela origem do negócio (ID ou nome)."),
  user: z.string().optional().describe("Filtra pelo responsável pelo negócio (ID do usuário)."),
  contact: z.string().optional().describe("Filtra pelo ID do contato associado ao negócio."),
  email: z.string().optional().describe("Filtra pelo e-mail associado ao negócio."),
  phone: z.string().optional().describe("Filtra pelo telefone associado ao negócio."),
  tags: tagsFilterSchema,
  ...paginationShape,
};

const getDealShape = {
  id: z.string().min(1).describe("ID do negócio na Clint."),
};

const createDealShape = {
  origin_id: z.string().min(1).describe("ID da origem do negócio."),
  name: z.string().min(1).describe("Nome/título do negócio."),
  phone: z.string().optional().describe("Telefone associado ao negócio."),
  email: z.string().email().optional().describe("E-mail associado ao negócio."),
  value: z.number().optional().describe("Valor do negócio."),
  stage_id: z.string().optional().describe("ID da etapa inicial do funil."),
  user_id: z.string().optional().describe("ID do usuário responsável pelo negócio."),
  contact_id: z.string().optional().describe("ID de um contato já existente para associar ao negócio."),
  fields: customFieldsSchema,
};

const updateDealShape = {
  id: z.string().min(1).describe("ID do negócio a atualizar."),
  stage_id: z.string().optional().describe("Nova etapa do funil."),
  status: z.string().optional().describe('Novo status do negócio (ex.: "open", "won", "lost").'),
  user_id: z.string().optional().describe("Novo responsável pelo negócio."),
  value: z.number().optional().describe("Novo valor do negócio."),
  origin_id: z.string().optional().describe("Nova origem do negócio."),
  fields: customFieldsSchema,
};

export function registerDealTools(server: McpServer, client: ClintClient): void {
  server.registerTool(
    "clint_list_deals",
    {
      title: "Listar negócios da Clint",
      description:
        "Lista negócios (deals) do CRM Clint, com filtros opcionais por status, etapa, origem, responsável, " +
        "contato, e-mail, telefone e tags. Suporta paginação manual (page/perPage) ou automática (fetchAllPages=true).",
      inputSchema: listDealsShape,
      annotations: {
        title: "Listar negócios",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const result = await paginatedList(
        (page, perPage) =>
          client.get("/v1/deals", {
            status: args.status,
            stage: args.stage,
            origin: args.origin,
            user: args.user,
            contact: args.contact,
            email: args.email,
            phone: args.phone,
            tags: toTagsArray(args.tags),
            page,
            per_page: perPage,
          }),
        { page: args.page, perPage: args.perPage, fetchAllPages: args.fetchAllPages }
      );

      const pageInfo = args.fetchAllPages ? ` em ${result.pagesFetched} página(s)` : "";
      const truncatedNote = result.truncated
        ? "\n\nAtenção: o limite de segurança de páginas foi atingido antes do fim dos resultados. Refine os filtros ou aumente perPage para ver mais."
        : "";

      return textResult(
        `Encontrado(s) ${result.items.length} negócio(s)${pageInfo}.${truncatedNote}\n\n${jsonBlock(result.items)}`
      );
    })
  );

  server.registerTool(
    "clint_get_deal",
    {
      title: "Obter negócio da Clint",
      description: "Obtém os dados completos de um negócio (deal) da Clint a partir do seu ID.",
      inputSchema: getDealShape,
      annotations: {
        title: "Obter negócio",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const deal = await client.get(`/v1/deals/${encodeURIComponent(args.id)}`);
      return textResult(jsonBlock(deal));
    })
  );

  server.registerTool(
    "clint_create_deal",
    {
      title: "Criar negócio na Clint",
      description:
        "Cria um novo negócio (deal) na Clint. Esta é uma operação de escrita/sensível: cria um registro real no CRM. " +
        "O resultado descreve claramente os dados enviados e o negócio criado.",
      inputSchema: createDealShape,
      annotations: {
        title: "Criar negócio",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const payload = {
        origin_id: args.origin_id,
        name: args.name,
        phone: args.phone,
        email: args.email,
        value: args.value,
        stage_id: args.stage_id,
        user_id: args.user_id,
        contact_id: args.contact_id,
        fields: args.fields,
      };

      const created = await client.post("/v1/deals", payload);

      return textResult(
        `Negócio criado com sucesso na Clint.\n\n` +
          `Dados enviados:\n${jsonBlock(payload)}\n\n` +
          `Resposta da API:\n${jsonBlock(created)}`
      );
    })
  );

  server.registerTool(
    "clint_update_deal",
    {
      title: "Atualizar negócio na Clint",
      description:
        "Atualiza um negócio (deal) existente na Clint: etapa, status, responsável, valor, origem e/ou campos " +
        "personalizados. Esta é uma operação de escrita/sensível: altera um registro real no CRM. O resultado " +
        "mostra claramente o valor anterior e o novo valor de cada campo alterado.",
      inputSchema: updateDealShape,
      annotations: {
        title: "Atualizar negócio",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const { id, ...rest } = args;
      const updates = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined));

      if (Object.keys(updates).length === 0) {
        return textResult(
          "Nenhum campo para atualizar foi informado. Informe ao menos um de: stage_id, status, user_id, value, origin_id, fields."
        );
      }

      let before: unknown;
      try {
        before = await client.get(`/v1/deals/${encodeURIComponent(id)}`);
      } catch {
        before = undefined;
      }

      const updated = await client.post(`/v1/deals/${encodeURIComponent(id)}`, updates);

      const beforeRecord = before && typeof before === "object" ? (before as Record<string, unknown>) : {};
      const diffLines = Object.entries(updates).map(
        ([key, newValue]) => `- ${key}: ${formatValue(beforeRecord[key])} → ${formatValue(newValue)}`
      );

      return textResult(
        `Negócio ${id} atualizado com sucesso na Clint.\n\n` +
          `Alterações aplicadas:\n${diffLines.join("\n")}\n\n` +
          `Resposta da API:\n${jsonBlock(updated)}`
      );
    })
  );
}
