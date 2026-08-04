import pool from "@/lib/db";

// Trilha de auditoria mínima pras rotas que já alteram dado de produção
// (roteiros/reuniões/comercial/clientes/usuários) mas não deixavam nenhum
// rastro sistemático de quem editou ou excluiu o quê — só existia
// reviewed_by_name/reviewed_at, preenchido só quando um master revisa
// status/nota, não em qualquer outra edição. `before`/`after` gravam o
// registro completo (JSONB) pra permitir reconstruir o que mudou depois,
// sem precisar de um esquema de diff campo a campo agora.

export type AuditEntityType = "roteiro" | "reuniao" | "comercial" | "cliente" | "usuario";
export type AuditAction = "edit" | "delete";

export async function registrarAuditoria(params: {
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorId: string | null;
  actorName: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before?: Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after?: Record<string, any> | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_log (entity_type, entity_id, action, actor_id, actor_name, before, after)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      params.entityType,
      params.entityId,
      params.action,
      params.actorId,
      params.actorName || "Desconhecido",
      params.before ? JSON.stringify(params.before) : null,
      params.after ? JSON.stringify(params.after) : null,
    ]
  );
}

export interface AuditLogEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  actorName: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorName: row.actor_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// Última edição/exclusão de um registro — usado pra mostrar "Editado por
// Fulano em DD/MM" no modal de detalhe de cada módulo.
export async function buscarUltimaAuditoria(
  entityType: AuditEntityType,
  entityId: string
): Promise<AuditLogEntry | null> {
  const result = await pool.query(
    `SELECT * FROM audit_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [entityType, entityId]
  );
  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}
