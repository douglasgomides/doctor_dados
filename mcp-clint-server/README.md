# clint-mcp-server

Servidor MCP (Model Context Protocol) local, escrito em TypeScript e usando
transporte **stdio**, que integra o Claude Code (ou qualquer outro cliente
MCP) à API do CRM [Clint](https://www.clint.digital).

Expõe 9 ferramentas para consultar e gerenciar contatos, negócios, origens e
tags diretamente pela conversa com o Claude.

## Ferramentas disponíveis

| Ferramenta | Tipo | Descrição |
|---|---|---|
| `clint_list_contacts` | leitura | Lista contatos, com filtros por nome, e-mail, telefone, origem e tags. |
| `clint_get_contact` | leitura | Obtém um contato pelo ID. |
| `clint_create_contact` | **escrita** | Cria um contato (`name`, `ddi`, `phone`, `email`, `username`, `fields`). |
| `clint_list_deals` | leitura | Lista negócios, com filtros por status, etapa, origem, responsável, contato, e-mail, telefone e tags. |
| `clint_get_deal` | leitura | Obtém um negócio pelo ID. |
| `clint_create_deal` | **escrita** | Cria um negócio (`origin_id`, `name`, `phone`, `email`, `value`, `stage_id`, `user_id`, `contact_id`, `fields`). |
| `clint_update_deal` | **escrita** | Atualiza etapa, status, responsável, valor, origem e/ou campos personalizados de um negócio. |
| `clint_list_origins` | leitura | Lista as origens cadastradas e seus IDs. |
| `clint_list_tags` | leitura | Lista as tags cadastradas. |

As três ferramentas de escrita (`clint_create_contact`, `clint_create_deal`,
`clint_update_deal`) são marcadas nas suas [`annotations`](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations)
com `readOnlyHint: false` — e `clint_update_deal` também com
`destructiveHint: true`, por alterar um registro existente — para que
clientes MCP tratem essas chamadas como operações sensíveis (ex.: exigindo
confirmação do usuário). Todas as três retornam, no resultado, exatamente os
dados enviados e (no caso do `clint_update_deal`) um diff campo a campo do
valor anterior → novo valor.

As ferramentas de listagem aceitam paginação manual (`page` / `perPage`) ou
automática: com `fetchAllPages: true`, o servidor percorre todas as páginas
disponíveis (até um limite de segurança de 20 páginas) e devolve a lista
completa.

## Pré-requisitos

- Node.js 18 ou superior (testado com Node 22).
- Um token de API da Clint. Ele fica disponível apenas em contas no plano
  Elite: **Conta → API → Copiar**.

## Instalação

```bash
cd mcp-clint-server
npm install
```

## Configuração

Copie `.env.example` para `.env` e preencha o token:

```bash
cp .env.example .env
```

```env
CLINT_API_TOKEN=seu_token_aqui

# Opcionais:
# CLINT_API_BASE_URL=https://api.clint.digital
# CLINT_API_TIMEOUT_MS=15000
```

O `.env` **não é lido automaticamente** pelo servidor (para manter o pacote
sem dependências desnecessárias) — as variáveis precisam estar no ambiente
do processo que inicia o servidor. O jeito mais simples é declará-las
diretamente na configuração MCP do seu cliente (veja abaixo), ou exportá-las
no shell antes de rodar `npm start` / `npm run dev`.

**Segurança:** o token nunca é impresso em logs, mensagens de erro ou na URL
das requisições — ele só é enviado no header HTTP `api-token`.

## Build

```bash
npm run build
```

Compila `src/` (TypeScript) para `dist/` (JavaScript, ESM). Para checar tipos
sem gerar arquivos: `npm run typecheck`.

## Rodando o servidor

Modo desenvolvimento (via `tsx`, sem precisar buildar antes):

```bash
CLINT_API_TOKEN=seu_token npm run dev
```

Modo produção (após `npm run build`):

```bash
CLINT_API_TOKEN=seu_token npm start
```

O servidor conversa via stdio — ele não abre nenhuma porta HTTP. Ele foi
feito para ser iniciado pelo próprio cliente MCP (Claude Code, Claude
Desktop, etc.), não para rodar isolado num terminal.

### Configurando no Claude Code

Adicione ao seu `.mcp.json` (ou via `claude mcp add`):

```json
{
  "mcpServers": {
    "clint": {
      "command": "node",
      "args": ["/caminho/absoluto/para/mcp-clint-server/dist/index.js"],
      "env": {
        "CLINT_API_TOKEN": "seu_token_aqui"
      }
    }
  }
}
```

Rode `npm run build` pelo menos uma vez antes, para que `dist/index.js`
exista.

## Testes

```bash
npm test
```

Roda os testes unitários (Vitest) do cliente HTTP (`src/client.ts`) e do
helper de paginação (`src/pagination.ts`), cobrindo:

- envio do header `api-token` e ausência do token na URL/mensagens de erro;
- serialização de query params (incluindo arrays e valores `undefined`);
- envio de corpo JSON em requisições `POST`;
- tratamento de erros HTTP (`ClintApiError` com `status`/`body`);
- timeout de requisição;
- falha de rede;
- corpo de resposta vazio ou não-JSON;
- paginação automática (`fetchAllPages`) e o limite de segurança de páginas.

`npm run test:watch` roda os testes em modo watch.

## Estrutura do projeto

```
src/
  client.ts       Cliente HTTP centralizado (fetch + header api-token + timeout + erros)
  errors.ts       ClintApiError
  pagination.ts   Normalização de respostas paginadas + paginação automática
  types.ts        Schemas Zod e tipos compartilhados entre ferramentas
  format.ts       Helpers de formatação de resultado/erro das ferramentas MCP
  server.ts       Monta o McpServer e registra todas as ferramentas
  index.ts        Entry point: conecta o servidor via StdioServerTransport
  tools/
    contacts.ts   clint_list_contacts, clint_get_contact, clint_create_contact
    deals.ts      clint_list_deals, clint_get_deal, clint_create_deal, clint_update_deal
    origins.ts    clint_list_origins
    tags.ts       clint_list_tags
tests/
  client.test.ts      Testes unitários do ClintClient
  pagination.test.ts  Testes unitários da paginação automática
```

## Observações sobre a API da Clint

Os endpoints, campos e o header de autenticação (`api-token`) seguem
exatamente a especificação fornecida para este servidor. A documentação
pública e interativa da API (`clint-api.readme.io`) não pôde ser acessada de
forma automatizada durante o desenvolvimento (retorna 403 para requisições
sem navegador), então alguns detalhes foram implementados de forma
defensiva/genérica e devem ser conferidos contra a documentação oficial da
sua conta antes do uso em produção:

- **Nomes dos parâmetros de filtro** em `clint_list_contacts` e
  `clint_list_deals` (`name`, `email`, `phone`, `origin`, `tags`, `status`,
  `stage`, `user`, `contact`) seguem a nomenclatura mais comum para esse
  tipo de API e ainda **não foram validados contra uma conta real**. Se a
  Clint usar nomes diferentes (ex.: `origin_id` em vez de `origin`), ajuste
  os `query` passados em `src/tools/contacts.ts` e `src/tools/deals.ts`.
- **Formato de paginação**: confirmado em produção (`GET /v1/tags` numa
  conta real) como `{ status, totalCount, page, totalPages, hasNext,
  hasPrevious, data: [...] }`. `src/pagination.ts` usa `hasNext` como sinal
  principal para decidir se busca a próxima página, com suporte defensivo
  a outros formatos (array puro, `{ data, meta: { current_page, last_page
  } }`, `{ items: [...] }`) como fallback, caso algum endpoint específico
  responda diferente.

## Licença

Uso interno.
