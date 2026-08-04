#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stdout é reservado para o protocolo MCP (JSON-RPC via stdio); qualquer
  // log do processo precisa ir para stderr, e nunca deve incluir o token.
  console.error("clint-mcp-server: conectado via stdio, aguardando requisições.");
}

main().catch((error) => {
  console.error("clint-mcp-server: falha ao iniciar:", error instanceof Error ? error.message : error);
  process.exit(1);
});
