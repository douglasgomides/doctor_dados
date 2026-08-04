import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ClintClient } from "../client.js";
import { paginatedList } from "../pagination.js";
import { paginationShape } from "../types.js";
import { textResult, jsonBlock, safeHandler } from "../format.js";

const listTagsShape = {
  ...paginationShape,
};

export function registerTagTools(server: McpServer, client: ClintClient): void {
  server.registerTool(
    "clint_list_tags",
    {
      title: "Listar tags da Clint",
      description: "Lista as tags cadastradas na conta Clint, úteis para filtrar ou marcar contatos e negócios.",
      inputSchema: listTagsShape,
      annotations: {
        title: "Listar tags",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    safeHandler(async (args) => {
      const result = await paginatedList((page, perPage) => client.get("/v1/tags", { page, per_page: perPage }), {
        page: args.page,
        perPage: args.perPage,
        fetchAllPages: args.fetchAllPages,
      });

      const pageInfo = args.fetchAllPages ? ` em ${result.pagesFetched} página(s)` : "";
      const truncatedNote = result.truncated
        ? "\n\nAtenção: o limite de segurança de páginas foi atingido antes do fim dos resultados."
        : "";

      return textResult(
        `Encontrada(s) ${result.items.length} tag(s)${pageInfo}.${truncatedNote}\n\n${jsonBlock(result.items)}`
      );
    })
  );
}
