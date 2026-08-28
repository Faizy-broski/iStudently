import { supabase } from '../../config/supabase'
import { CallerContext } from './types'

/**
 * Append-only audit writer for the Al-Fina' module (spec §7.6). Every write
 * path in the module must call this — a listener/observer pattern, not a
 * scattered manual call per endpoint, per the spec's own explicit warning
 * ("you will forget the manual call in exactly the code path that gets
 * audited"). In this Express codebase that means: call logAuditFromCaller()
 * at the end of every service-layer mutation, not from the controller (so
 * it fires even when a service function is called from another service, not
 * just from an HTTP request).
 *
 * The actual hash-chain computation happens server-side in Postgres (see
 * 239_create_fina_audit_log.sql) — this module only ever INSERTs and never
 * computes row_hash/prev_hash itself.
 */

export interface AuditLogInput {
  schoolId: string
  actorId?: string | null
  actorRole?: string | null
  action: string
  subjectType?: string
  subjectId?: string
  meta?: Record<string, unknown>
  ip?: string | null
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  const { error } = await supabase.from('fina_audit_log').insert({
    school_id: input.schoolId,
    actor_id: input.actorId ?? null,
    actor_role: input.actorRole ?? null,
    action: input.action,
    subject_type: input.subjectType ?? null,
    subject_id: input.subjectId ?? null,
    meta: input.meta ?? {},
    ip: input.ip ?? null,
  })

  if (error) {
    // Must never throw and block the write path that triggered it — the
    // mutation being audited has already happened by the time this fires.
    // But an audit-write failure is itself a serious event and must be
    // loud, not silently swallowed.
    console.error('CRITICAL: fina_audit_log insert failed — the triggering write still succeeded:', error, input)
  }
}

export function logAuditFromCaller(
  caller: CallerContext,
  action: string,
  opts: { subjectType?: string; subjectId?: string; meta?: Record<string, unknown>; ip?: string | null } = {}
): Promise<void> {
  return logAudit({
    schoolId: caller.schoolId,
    actorId: caller.profileId,
    actorRole: caller.role,
    action,
    subjectType: opts.subjectType,
    subjectId: opts.subjectId,
    meta: opts.meta,
    ip: opts.ip,
  })
}

/**
 * Walks the entire hash chain server-side (via the fina_audit_verify_chain()
 * Postgres function defined alongside the table) and reports whether it's
 * intact. Used by the nightly fina:audit-verify job (Phase 5) and available
 * for an ad-hoc admin-triggered check from day one.
 */
export async function verifyChain(): Promise<{ ok: true } | { ok: false; brokenAtSeq: number }> {
  const { data, error } = await supabase.rpc('fina_audit_verify_chain')
  if (error) {
    console.error('CRITICAL: fina_audit_verify_chain RPC failed:', error)
    return { ok: false, brokenAtSeq: -1 }
  }
  return data === null ? { ok: true } : { ok: false, brokenAtSeq: data as number }
}
