import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ClintClient } from "../client.js";
import { paginatedList } from "../pagination.js";
import { paginationShape } from "../types.js";
import { textResult, jsonBlock, safeHandler } from "../format.js";

const listOriginsShape = {
  ...paginationShape,
};

export function registerOriginTools(server: McpServer, client: ClintClient): void {
  server.registerTool(
    "clint_list_origins",
    {
      title: "Listar origens da Clint",
      description:
        "Lista as origens (origins) cadastradas na conta Clint, com seus respectivos IDs — úteis para filtrar " +
        "contatos/negócios por origem ou para informar origin_id ao criar um negócio.",
      inputSchema: listOriginsShape,
      annotations: {
        title: "Listar origens",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const result = await paginatedList(
        (page, perPage) => client.get("/v1/origins", { page, per_page: perPage }),
        { page: args.page, perPage: args.perPage, fetchAllPages: args.fetchAllPages }
      );

      const pageInfo = args.fetchAllPages ? ` em ${result.pagesFetched} página(s)` : "";
      const truncatedNote = result.truncated
        ? "\n\nAtenção: o limite de segurança de páginas foi atingido antes do fim dos resultados."
        : "";

      return textResult(
        `Encontrada(s) ${result.items.length} origem(ns)${pageInfo}.${truncatedNote}\n\n${jsonBlock(result.items)}`
      );
    })
  );
}
