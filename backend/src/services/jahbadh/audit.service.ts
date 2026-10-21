import { supabase } from '../../config/supabase'

/**
 * Append-only audit trail of the Jahbadh grades plugin (jg_audit_log; UPDATE/DELETE are blocked by
 * a trigger). Every mark, second-round mark, lock, rules edit and setup is written here.
 * Never throws: a failed audit write is logged and must not block the change that triggered it.
 */
export interface JgAuditInput {
  schoolId: string
  actorId?: string | null
  actorRole?: string | null
  action: string
  entity: string
  entityId?: string | null
  sectionId?: string | null
  studentId?: string | null
  before?: unknown
  after?: unknown
}

export async function logJgAudit(rows: JgAuditInput | JgAuditInput[]): Promise<void> {
  const list = Array.isArray(rows) ? rows : [rows]
  if (!list.length) return
  const { error } = await supabase.from('jg_audit_log').insert(
    list.map((r) => ({
      school_id: r.schoolId,
      actor_id: r.actorId ?? null,
      actor_role: r.actorRole ?? null,
      action: r.action,
      entity: r.entity,
      entity_id: r.entityId ?? null,
      section_id: r.sectionId ?? null,
      student_id: r.studentId ?? null,
      before: r.before === undefined ? null : r.before,
      after: r.after === undefined ? null : r.after,
    })),
  )
  if (error) console.error('jg_audit_log insert failed:', error.message, list.map((r) => r.action))
}
