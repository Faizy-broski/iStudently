import { supabase } from '../../config/supabase'
import { CallerContext, VaultFieldDefinition } from './types'
import { logVaultAuditFromCaller } from './audit-logger.service'

export async function listFieldDefinitions(caller: CallerContext, category?: string): Promise<VaultFieldDefinition[]> {
  let query = supabase
    .from('vault_field_definitions')
    .select('*')
    .eq('school_id', caller.schoolId)
    .order('sort_order', { ascending: true })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list field definitions: ${error.message}`)
  return data || []
}

export interface CreateFieldDefinitionInput {
  category: string
  fieldKey: string
  labelEn: string
  labelAr: string
  fieldType: string
  options?: string[]
  isRequired?: boolean
  isSecret?: boolean
  sortOrder?: number
}

export async function createFieldDefinition(
  caller: CallerContext,
  input: CreateFieldDefinitionInput,
  ip?: string | null
): Promise<VaultFieldDefinition> {
  const { data, error } = await supabase
    .from('vault_field_definitions')
    .insert({
      school_id: caller.schoolId,
      category: input.category,
      field_key: input.fieldKey,
      label_en: input.labelEn,
      label_ar: input.labelAr,
      field_type: input.fieldType,
      options: input.options ?? [],
      is_required: input.isRequired ?? false,
      is_secret: input.isSecret ?? false,
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create field definition: ${error?.message || 'unknown error'}`)

  await logVaultAuditFromCaller(caller, 'field_definition.created', {
    subjectType: 'vault_field_definition',
    subjectId: data.id,
    meta: { fieldKey: input.fieldKey, category: input.category },
    ip,
  })

  return data
}

export async function deleteFieldDefinition(caller: CallerContext, id: string, ip?: string | null): Promise<void> {
  const { error } = await supabase.from('vault_field_definitions').delete().eq('id', id).eq('school_id', caller.schoolId)
  if (error) throw new Error(`Failed to delete field definition: ${error.message}`)

  await logVaultAuditFromCaller(caller, 'field_definition.deleted', { subjectType: 'vault_field_definition', subjectId: id, ip })
}

/** field_key -> is_secret map for one category — used by records.service.ts to decide what to encrypt. */
export async function getSecretFieldKeys(schoolId: string, category: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('vault_field_definitions')
    .select('field_key')
    .eq('school_id', schoolId)
    .eq('category', category)
    .eq('is_secret', true)

  if (error) throw new Error(`Failed to load secret field definitions: ${error.message}`)
  return new Set((data || []).map((d) => d.field_key as string))
}
