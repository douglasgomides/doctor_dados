import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ClintClient, type ClintClientOptions } from "./client.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerDealTools } from "./tools/deals.js";
import { registerOriginTools } from "./tools/origins.js";
import { registerTagTools } from "./tools/tags.js";

export const SERVER_NAME = "clint-mcp-server";
export const SERVER_VERSION = "0.1.0";

/**
 * Monta o McpServer com todas as ferramentas Clint registradas, usando um
 * ClintClient próprio. `clientOptions` existe principalmente para testes.
 */
export function createServer(clientOptions: ClintClientOptions = {}): McpServer {
  const client = new ClintClient(clientOptions);

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerContactTools(server, client);
  registerDealTools(server, client);
  registerOriginTools(server, client);
  registerTagTools(server, client);

  return server;
}
