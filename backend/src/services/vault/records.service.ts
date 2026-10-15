import { supabase } from '../../config/supabase'
import { encryptSecret, decryptSecret } from '../../utils/crypto'
import { CallerContext, VaultRecord } from './types'
import { getSecretFieldKeys } from './field-definitions.service'
import { logVaultAuditFromCaller } from './audit-logger.service'

const ENCRYPTED_PREFIX = 'ENCRYPTED::'

/**
 * Encrypts any customFields value whose key is in secretKeys, using the
 * codebase's existing AES-256-GCM utility (backend/src/utils/crypto.ts,
 * already used for TOTP secrets and recoverable login passwords — reused
 * as-is here, no generalization needed). Stored with an ENCRYPTED:: prefix
 * marker (matching the spec's own example payload) so a plain read can show
 * the masked marker without ever decrypting. Idempotent: a value already
 * carrying the prefix is left untouched, so re-saving an unchanged secret
 * field doesn't double-encrypt it.
 */
function encryptCustomFields(customFields: Record<string, unknown>, secretKeys: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...customFields }
  for (const key of secretKeys) {
    const value = result[key]
    if (value == null) continue
    if (typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX)) continue
    result[key] = ENCRYPTED_PREFIX + encryptSecret(String(value))
  }
  return result
}

// Attachment keys come from the client, and GET /vault/media/:recordId/attachments/:i downloads
// whatever key the record holds. Only keys minted by uploadAttachment for this same school are
// accepted (plus keys the record already had, on update); otherwise a vault user could store
// another school's key and read that school's file.
const ATTACHMENT_KEY = /^([0-9a-f-]{36})\/vault\/[0-9a-f-]{36}(\.[A-Za-z0-9]{1,10})?$/i

export function assertOwnAttachments(schoolId: string, keys: unknown, alreadyOnRecord: string[] = []): string[] {
  if (keys == null) return []
  if (!Array.isArray(keys)) throw new Error('Invalid attachments: expected a list of uploaded files')
  for (const key of keys) {
    if (typeof key === 'string' && alreadyOnRecord.includes(key)) continue
    const m = typeof key === 'string' ? ATTACHMENT_KEY.exec(key) : null
    if (!m || m[1].toLowerCase() !== schoolId.toLowerCase()) throw new Error('Invalid attachments: each attachment must be uploaded through /vault/media/upload')
  }
  return keys as string[]
}

export async function listRecords(
  caller: CallerContext,
  filters: { category?: string } = {}
): Promise<VaultRecord[]> {
  let query = supabase.from('vault_records').select('*').eq('school_id', caller.schoolId).order('created_at', { ascending: false })
  if (filters.category) query = query.eq('category', filters.category)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list vault records: ${error.message}`)
  return data || []
}

export async function getRecord(caller: CallerContext, id: string): Promise<VaultRecord> {
  const { data, error } = await supabase.from('vault_records').select('*').eq('id', id).eq('school_id', caller.schoolId).maybeSingle()
  if (error) throw new Error(`Failed to load vault record: ${error.message}`)
  if (!data) throw new Error('Vault record not found')
  return data
}

export interface CreateVaultRecordInput {
  category: string
  subCategory: string
  title: string
  defaultFields?: Record<string, unknown>
  customFields?: Record<string, unknown>
  attachments?: string[]
  expiryDate?: string | null
}

export async function createRecord(caller: CallerContext, input: CreateVaultRecordInput, ip?: string | null): Promise<VaultRecord> {
  const attachments = assertOwnAttachments(caller.schoolId, input.attachments)
  const secretKeys = await getSecretFieldKeys(caller.schoolId, input.category)
  const customFields = encryptCustomFields(input.customFields ?? {}, secretKeys)

  const { data, error } = await supabase
    .from('vault_records')
    .insert({
      school_id: caller.schoolId,
      category: input.category,
      sub_category: input.subCategory,
      title: input.title,
      default_fields: input.defaultFields ?? {},
      custom_fields: customFields,
      attachments,
      expiry_date: input.expiryDate ?? null,
      created_by: caller.profileId,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create vault record: ${error?.message || 'unknown error'}`)

  await logVaultAuditFromCaller(caller, 'record.created', {
    subjectType: 'vault_record',
    subjectId: data.id,
    meta: { category: input.category, subCategory: input.subCategory },
    ip,
  })

  return data
}

export interface UpdateVaultRecordInput {
  title?: string
  subCategory?: string
  defaultFields?: Record<string, unknown>
  customFields?: Record<string, unknown>
  attachments?: string[]
  expiryDate?: string | null
}

export async function updateRecord(caller: CallerContext, id: string, input: UpdateVaultRecordInput, ip?: string | null): Promise<VaultRecord> {
  const existing = await getRecord(caller, id)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title !== undefined) updates.title = input.title
  if (input.subCategory !== undefined) updates.sub_category = input.subCategory
  if (input.defaultFields !== undefined) updates.default_fields = input.defaultFields
  if (input.attachments !== undefined) updates.attachments = assertOwnAttachments(caller.schoolId, input.attachments, existing.attachments ?? [])
  if (input.expiryDate !== undefined) updates.expiry_date = input.expiryDate
  if (input.customFields !== undefined) {
    const secretKeys = await getSecretFieldKeys(caller.schoolId, existing.category)
    updates.custom_fields = encryptCustomFields(input.customFields, secretKeys)
  }

  const { data, error } = await supabase.from('vault_records').update(updates).eq('id', id).eq('school_id', caller.schoolId).select().single()
  if (error || !data) throw new Error(`Failed to update vault record: ${error?.message || 'unknown error'}`)

  await logVaultAuditFromCaller(caller, 'record.updated', { subjectType: 'vault_record', subjectId: id, meta: { fields: Object.keys(updates) }, ip })

  return data
}

export async function deleteRecord(caller: CallerContext, id: string, ip?: string | null): Promise<void> {
  await getRecord(caller, id) // 'Vault record not found' if it doesn't belong to this school

  const { error } = await supabase.from('vault_records').delete().eq('id', id).eq('school_id', caller.schoolId)
  if (error) throw new Error(`Failed to delete vault record: ${error.message}`)

  await logVaultAuditFromCaller(caller, 'record.deleted', { subjectType: 'vault_record', subjectId: id, ip })
}

/**
 * The ONLY path that ever returns a secret's plaintext (spec §1: "Every
 * read (REVEAL_SECRET)... generates an immutable VaultAuditLog record").
 * Always paired with a REVEAL_SECRET audit write — never call
 * decryptSecret() directly from a controller.
 */
export async function revealSecret(caller: CallerContext, recordId: string, fieldKey: string, ip?: string | null): Promise<string> {
  const record = await getRecord(caller, recordId)
  const raw = record.custom_fields?.[fieldKey]

  if (typeof raw !== 'string' || !raw.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Field is not an encrypted secret')
  }

  const plaintext = decryptSecret(raw.slice(ENCRYPTED_PREFIX.length))

  await logVaultAuditFromCaller(caller, 'reveal_secret', { subjectType: 'vault_record', subjectId: recordId, meta: { fieldKey }, ip })

  return plaintext
}
