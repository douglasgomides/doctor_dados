import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ClintClient } from "../client.js";
import { paginatedList } from "../pagination.js";
import { paginationShape, tagsFilterSchema, toTagsArray, customFieldsSchema } from "../types.js";
import { textResult, jsonBlock, safeHandler } from "../format.js";

const listContactsShape = {
  name: z.string().optional().describe("Filtra contatos pelo nome (busca parcial)."),
  email: z.string().optional().describe("Filtra contatos pelo e-mail."),
  phone: z.string().optional().describe("Filtra contatos pelo telefone."),
  origin: z.string().optional().describe("Filtra contatos pela origem (ID ou nome da origem)."),
  tags: tagsFilterSchema,
  ...paginationShape,
};

const getContactShape = {
  id: z.string().min(1).describe("ID do contato na Clint."),
};

const createContactShape = {
  name: z.string().min(1).describe("Nome do contato."),
  ddi: z.string().optional().describe('DDI do telefone, sem símbolos (ex.: "55").'),
  phone: z.string().optional().describe("Telefone do contato, sem o DDI."),
  email: z.string().email().optional().describe("E-mail do contato."),
  username: z.string().optional().describe("Identificador do contato num canal (ex.: usuário do Instagram/WhatsApp)."),
  fields: customFieldsSchema,
};

export function registerContactTools(server: McpServer, client: ClintClient): void {
  server.registerTool(
    "clint_list_contacts",
    {
      title: "Listar contatos da Clint",
      description:
        "Lista contatos do CRM Clint, com filtros opcionais por nome, e-mail, telefone, origem e tags. " +
        "Suporta paginação manual (page/perPage) ou automática (fetchAllPages=true).",
      inputSchema: listContactsShape,
      annotations: {
        title: "Listar contatos",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const result = await paginatedList(
        (page, perPage) =>
          client.get("/v1/contacts", {
            name: args.name,
            email: args.email,
            phone: args.phone,
            origin: args.origin,
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
        `Encontrado(s) ${result.items.length} contato(s)${pageInfo}.${truncatedNote}\n\n${jsonBlock(result.items)}`
      );
    })
  );

  server.registerTool(
    "clint_get_contact",
    {
      title: "Obter contato da Clint",
      description: "Obtém os dados completos de um contato da Clint a partir do seu ID.",
      inputSchema: getContactShape,
      annotations: {
        title: "Obter contato",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const contact = await client.get(`/v1/contacts/${encodeURIComponent(args.id)}`);
      return textResult(jsonBlock(contact));
    })
  );

  server.registerTool(
    "clint_create_contact",
    {
      title: "Criar contato na Clint",
      description:
        "Cria um novo contato na Clint. Esta é uma operação de escrita/sensível: cria um registro real no CRM. " +
        "O resultado descreve claramente os dados enviados e o contato criado.",
      inputSchema: createContactShape,
      annotations: {
        title: "Criar contato",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const payload = {
        name: args.name,
        ddi: args.ddi,
        phone: args.phone,
        email: args.email,
        username: args.username,
        fields: args.fields,
      };

      const created = await client.post("/v1/contacts", payload);

      return textResult(
        `Contato criado com sucesso na Clint.\n\n` +
          `Dados enviados:\n${jsonBlock(payload)}\n\n` +
          `Resposta da API:\n${jsonBlock(created)}`
      );
    })
  );
}
