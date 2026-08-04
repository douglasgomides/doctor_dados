import pool from "@/lib/db";

// Todas as migrações de schema do app (tabelas + colunas novas), separadas
// da criação do admin inicial (que só faz sentido em /api/db/init, o único
// lugar que roda sem ninguém logado ainda). Idempotente — todo CREATE/ALTER
// usa IF NOT EXISTS, então rodar de novo não faz mal. Chamada por:
// - POST /api/db/init (setup inicial, protegido por DB_INIT_SECRET)
// - POST /api/admin/migrate (atualizações depois do setup, master logado)
export async function runMigrations(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dash_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'client',
      account_id VARCHAR(100) NOT NULL DEFAULT '',
      account_name VARCHAR(255) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roteiros (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID NOT NULL REFERENCES dash_users(id) ON DELETE CASCADE,
      author_name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      format VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      score INTEGER NOT NULL,
      issues JSONB NOT NULL DEFAULT '[]',
      review_note TEXT,
      reviewed_by_name VARCHAR(255),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reunioes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID NOT NULL REFERENCES dash_users(id) ON DELETE CASCADE,
      author_name VARCHAR(255) NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      tipo VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      score INTEGER NOT NULL,
      issues JSONB NOT NULL DEFAULT '[]',
      suggested_agenda JSONB NOT NULL DEFAULT '[]',
      review_note TEXT,
      reviewed_by_name VARCHAR(255),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(255) UNIQUE NOT NULL,
      responsavel_id UUID REFERENCES dash_users(id) ON DELETE SET NULL,
      telefone_whatsapp VARCHAR(30),
      roteiros_por_semana INTEGER,
      reunioes_por_mes INTEGER,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE roteiros
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
  `);

  // Id do item de origem no Calendário (app Lovable/Supabase) — permite a
  // importação automática ser idempotente: se o trigger do Postgres de lá
  // disparar mais de uma vez pro mesmo item (reenvio, retry), o índice
  // único abaixo evita duplicar o roteiro. NULL pra roteiros criados
  // manualmente (não têm content_id, e vários NULLs são permitidos num
  // índice único parcial).
  await pool.query(`ALTER TABLE roteiros ADD COLUMN IF NOT EXISTS content_id VARCHAR(255);`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_roteiros_content_id
    ON roteiros(content_id) WHERE content_id IS NOT NULL;
  `);
  await pool.query(`
    ALTER TABLE reunioes
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE dash_users
    ADD COLUMN IF NOT EXISTS telefone_whatsapp VARCHAR(30);
  `);

  // Incrementada a cada troca de senha/papel (e implicitamente ignorada
  // quando o usuário é excluído, já que a linha some) — comparada contra o
  // valor gravado no cookie de sessão pras rotas mais sensíveis (gestão de
  // usuários e administração), porque o middleware roda em Edge e não
  // consegue consultar o banco a cada request. Ver src/lib/session-guard.ts.
  await pool.query(`
    ALTER TABLE dash_users
    ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE reunioes
    ADD COLUMN IF NOT EXISTS suggested_content_ideas JSONB NOT NULL DEFAULT '[]';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comercial_analises (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(500) NOT NULL DEFAULT '',
      participantes JSONB NOT NULL DEFAULT '[]',
      content TEXT NOT NULL,
      status VARCHAR(20) NOT NULL,
      score INTEGER NOT NULL,
      issues JSONB NOT NULL DEFAULT '[]',
      pontos_fortes JSONB NOT NULL DEFAULT '[]',
      pontos_melhoria JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS resultado VARCHAR(20);`);
  await pool.query(`ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS valor_fechado NUMERIC;`);
  // Usada pra detectar negociação parada (resultado = 'em_negociacao' sem
  // nenhuma atualização há muito tempo) — ver src/lib/pendencias.ts.
  await pool.query(
    `ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`
  );

  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE roteiros ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(`ALTER TABLE reunioes ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`);
  await pool.query(
    `ALTER TABLE comercial_analises ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;`
  );

  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS especialidade VARCHAR(255);`);
  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade VARCHAR(255);`);
  await pool.query(`ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plano VARCHAR(255);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reuniao_clientes (
      reuniao_id UUID NOT NULL REFERENCES reunioes(id) ON DELETE CASCADE,
      cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      cliente_nome VARCHAR(255) NOT NULL,
      PRIMARY KEY (reuniao_id, cliente_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_tarefas (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo VARCHAR(500) NOT NULL DEFAULT '',
      participantes JSONB NOT NULL DEFAULT '[]',
      itens JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Trilha de auditoria — quem editou/excluiu o quê, com snapshot completo
  // do registro antes/depois (ver src/lib/audit-log.ts).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(30) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(10) NOT NULL,
      actor_id UUID,
      actor_name VARCHAR(255) NOT NULL,
      before JSONB,
      after JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);`
  );

  // Índices nas colunas mais filtradas pelos dashboards agregados e pelas
  // rotas de listagem — sem efeito hoje com o volume atual, mas evita virar
  // seq scan conforme o histórico crescer.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_roteiros_client_id ON roteiros(client_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_roteiros_author_id ON roteiros(author_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_roteiros_status ON roteiros(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reunioes_client_id ON reunioes(client_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reunioes_author_id ON reunioes(author_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reunioes_status ON reunioes(status);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reuniao_clientes_cliente_id ON reuniao_clientes(cliente_id);`
  );

  // --- Clint CRM (contatos, negócios, origens, tags) ---
  // Espelho local dos dados da Clint, sincronizado periodicamente via
  // POST /api/automations/clint-sync (n8n dispara, mesmo padrão dos outros
  // automations). Existe pra o dashboard de inteligência comercial não
  // depender de consultar a API da Clint (62k+ contatos) a cada carregamento
  // de página.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_contacts (
      id UUID PRIMARY KEY,
      name VARCHAR(500),
      email VARCHAR(255),
      ddi VARCHAR(10),
      phone VARCHAR(30),
      username VARCHAR(255),
      full_phone VARCHAR(40),
      organization_id UUID,
      tags JSONB NOT NULL DEFAULT '[]',
      fields JSONB NOT NULL DEFAULT '{}',
      clint_created_at TIMESTAMPTZ,
      clint_updated_at TIMESTAMPTZ,
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_clint_contacts_created_at ON clint_contacts(clint_created_at);`
  );
  // GIN pra permitir filtrar por tag (tags é um array de {id,name,color}).
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_contacts_tags ON clint_contacts USING GIN (tags);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_deals (
      id UUID PRIMARY KEY,
      origin_id UUID,
      user_id UUID,
      user_name VARCHAR(255),
      user_email VARCHAR(255),
      contact_id UUID,
      contact_name VARCHAR(500),
      status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
      stage VARCHAR(255),
      stage_id UUID,
      value NUMERIC NOT NULL DEFAULT 0,
      currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
      won_at TIMESTAMPTZ,
      lost_at TIMESTAMPTZ,
      lost_status_id UUID,
      fields JSONB NOT NULL DEFAULT '{}',
      clint_created_at TIMESTAMPTZ,
      clint_updated_at TIMESTAMPTZ,
      clint_updated_stage_at TIMESTAMPTZ,
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_deals_status ON clint_deals(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_deals_origin_id ON clint_deals(origin_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_deals_stage_id ON clint_deals(stage_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_deals_contact_id ON clint_deals(contact_id);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_clint_deals_created_at ON clint_deals(clint_created_at);`
  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_deals_fields ON clint_deals USING GIN (fields);`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_origins (
      id UUID PRIMARY KEY,
      name VARCHAR(255),
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_tags (
      id UUID PRIMARY KEY,
      name VARCHAR(255),
      color VARCHAR(20),
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Não existe endpoint da Clint que liste todas as etapas do funil — só
  // aparecem embutidas em cada negócio (stage_id + stage). Construímos essa
  // tabela de referência de forma oportunista durante a sincronização de
  // negócios (upsert do par visto em cada registro).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_stages (
      id UUID PRIMARY KEY,
      name VARCHAR(255),
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // Controla o progresso da sincronização por recurso, pra ela ser
  // retomável: cada chamada ao endpoint de automação processa páginas até
  // estourar seu orçamento de tempo (função serverless) e grava até onde
  // chegou. A próxima chamada continua dali.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_sync_state (
      resource VARCHAR(20) PRIMARY KEY,
      next_page INTEGER NOT NULL DEFAULT 1,
      total_pages INTEGER,
      total_count INTEGER,
      records_synced_last_run INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'idle',
      last_error TEXT,
      last_run_at TIMESTAMP,
      last_completed_at TIMESTAMP
    );
  `);

  // --- Clint: chats e mensagens (WhatsApp/Instagram) ---
  // Formato confirmado manualmente contra a conta real via
  // GET /v2/chats/contact/{contactId} e GET /v2/messages/chat/{chatId}.
  // Não existe endpoint que liste chats/mensagens em massa — só por
  // contato/chat — então a sincronização (ver src/lib/clint-sync.ts,
  // resource "messages") é escopada aos contatos com pelo menos um negócio
  // associado (relevantes comercialmente), priorizando os mais recentes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_chats (
      id UUID PRIMARY KEY,
      contact_id UUID,
      user_id UUID,
      status VARCHAR(20),
      replied BOOLEAN NOT NULL DEFAULT false,
      seen BOOLEAN NOT NULL DEFAULT false,
      unread BOOLEAN NOT NULL DEFAULT false,
      unseen_count INTEGER NOT NULL DEFAULT 0,
      channel_account_id UUID,
      first_customer_message_at TIMESTAMPTZ,
      first_response_at TIMESTAMPTZ,
      last_message_at TIMESTAMPTZ,
      last_response_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      clint_created_at TIMESTAMPTZ,
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_chats_contact_id ON clint_chats(contact_id);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_clint_chats_first_response_at ON clint_chats(first_response_at);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_messages (
      id UUID PRIMARY KEY,
      chat_id UUID NOT NULL,
      user_id UUID,
      content TEXT,
      type VARCHAR(20),
      content_type VARCHAR(30),
      status VARCHAR(20),
      clint_created_at TIMESTAMPTZ,
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_clint_messages_chat_id ON clint_messages(chat_id);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_clint_messages_created_at ON clint_messages(clint_created_at);`
  );

  // Referência de canais (WhatsApp Oficial, Instagram de cada perfil) — só
  // 3 registros hoje, via GET /v2/channel-accounts. O campo `status`
  // ("CONNECTED"/"DISCONNECTED") é crítico: um canal desconectado para de
  // receber mensagens novas na Clint sem gerar nenhum alerta visível pra
  // quem usa o CRM no dia a dia.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clint_channel_accounts (
      id UUID PRIMARY KEY,
      name VARCHAR(255),
      type VARCHAR(30),
      status VARCHAR(20),
      identifier VARCHAR(255),
      synced_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}
