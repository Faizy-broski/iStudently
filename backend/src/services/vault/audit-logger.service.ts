import { supabase } from '../../config/supabase'
import { CallerContext } from './types'

/**
 * Append-only audit writer for AdminVault (spec §1). Mirrors
 * fina/audit-logger.service.ts exactly, including its warning: call this at
 * the end of every service-layer mutation (never scattered per-endpoint in
 * controllers) so it fires even when a service function is called from
 * another service, not just from an HTTP request.
 *
 * The actual hash-chain computation happens server-side in Postgres (see
 * 299_create_vault_audit_log.sql) — this module only ever INSERTs and never
 * computes row_hash/prev_hash itself.
 */

export interface VaultAuditLogInput {
  schoolId: string
  actorId?: string | null
  actorRole?: string | null
  action: string
  subjectType?: string
  subjectId?: string
  meta?: Record<string, unknown>
  ip?: string | null
}

export async function logVaultAudit(input: VaultAuditLogInput): Promise<void> {
  const { error } = await supabase.from('vault_audit_log').insert({
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
    console.error('CRITICAL: vault_audit_log insert failed — the triggering write still succeeded:', error, input)
  }
}

export function logVaultAuditFromCaller(
  caller: CallerContext,
  action: string,
  opts: { subjectType?: string; subjectId?: string; meta?: Record<string, unknown>; ip?: string | null } = {}
): Promise<void> {
  return logVaultAudit({
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
 * Walks the entire hash chain server-side (via vault_audit_verify_chain(),
 * defined alongside the table) and reports whether it's intact.
 */
export async function verifyVaultAuditChain(): Promise<{ ok: true } | { ok: false; brokenAtSeq: number }> {
  const { data, error } = await supabase.rpc('vault_audit_verify_chain')
  if (error) {
    console.error('CRITICAL: vault_audit_verify_chain RPC failed:', error)
    return { ok: false, brokenAtSeq: -1 }
  }
  return data === null ? { ok: true } : { ok: false, brokenAtSeq: data as number }
}
