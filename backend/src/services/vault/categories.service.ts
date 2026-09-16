import { supabase } from '../../config/supabase'
import { CallerContext } from './types'
import { logVaultAuditFromCaller } from './audit-logger.service'

export interface CustomVaultCategory {
  id: string
  label_en: string
  label_ar: string
  created_at: string
}

export const DEFAULT_VAULT_CATEGORIES: CustomVaultCategory[] = [
  { id: 'facility_utilities', label_en: 'Facility & Utilities', label_ar: 'المرافق والخدمات', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'legal_licensing', label_en: 'Legal & Licensing', label_ar: 'الشؤون القانونية والتراخيص', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'financial_procurement', label_en: 'Financial & Procurement', label_ar: 'الشؤون المالية والمشتريات', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'it_security', label_en: 'IT & Security', label_ar: 'تقنية المعلومات والأمن', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'hr_confidential', label_en: 'HR Confidential', label_ar: 'الموارد البشرية (سري)', created_at: '2026-01-01T00:00:00.000Z' },
]

/** Read vault categories from the school_settings JSONB for this school. */
export async function listCustomCategories(schoolId: string): Promise<CustomVaultCategory[]> {
  const { data, error } = await supabase
    .from('school_settings')
    .select('vault_custom_categories')
    .eq('school_id', schoolId)
    .is('campus_id', null)
    .maybeSingle()

  if (error) throw new Error(`Failed to read vault categories: ${error.message}`)
  const raw = data?.vault_custom_categories as CustomVaultCategory[] | null
  if (!raw || raw.length === 0) {
    return DEFAULT_VAULT_CATEGORIES
  }
  return raw
}

/**
 * Persist an updated categories array back to school_settings.
 * Uses UPDATE-then-INSERT instead of upsert to avoid needing a named constraint.
 */
async function persistCategories(schoolId: string, categories: CustomVaultCategory[]): Promise<void> {
  // Try UPDATE first (the row almost certainly already exists)
  const { error: updateErr, count } = await supabase
    .from('school_settings')
    .update({ vault_custom_categories: categories })
    .eq('school_id', schoolId)
    .is('campus_id', null)

  if (updateErr) throw new Error(`Failed to save custom categories: ${updateErr.message}`)

  // If no row was updated, create one
  if (count === 0) {
    const { error: insertErr } = await supabase
      .from('school_settings')
      .insert({ school_id: schoolId, campus_id: null, vault_custom_categories: categories })

    if (insertErr) throw new Error(`Failed to save custom categories: ${insertErr.message}`)
  }
}

/** Add a new vault category (stored in school_settings JSONB). */
export async function createCustomCategory(
  caller: CallerContext,
  input: { id: string; label_en: string; label_ar: string },
  ip?: string | null
): Promise<CustomVaultCategory[]> {
  if (!/^[a-z0-9_]{2,40}$/.test(input.id)) {
    throw new Error('Category ID must be 2-40 lowercase letters, numbers, or underscores')
  }
  const existing = await listCustomCategories(caller.schoolId)
  if (existing.some(c => c.id === input.id)) {
    throw new Error(`Category "${input.id}" already exists`)
  }
  const newCat: CustomVaultCategory = {
    id: input.id,
    label_en: input.label_en,
    label_ar: input.label_ar,
    created_at: new Date().toISOString(),
  }
  const updated = [...existing, newCat]
  await persistCategories(caller.schoolId, updated)
  await logVaultAuditFromCaller(caller, 'category.created', {
    subjectType: 'vault_category',
    subjectId: input.id,
    meta: { label_en: input.label_en },
    ip,
  })
  return updated
}

/** Delete a vault category. Any category can now be removed. */
export async function deleteCustomCategory(
  caller: CallerContext,
  categoryId: string,
  ip?: string | null
): Promise<void> {
  const existing = await listCustomCategories(caller.schoolId)
  const next = existing.filter(c => c.id !== categoryId)
  if (next.length === existing.length) {
    throw new Error(`Category "${categoryId}" not found`)
  }
  await persistCategories(caller.schoolId, next)
  await logVaultAuditFromCaller(caller, 'category.deleted', {
    subjectType: 'vault_category',
    subjectId: categoryId,
    ip,
  })
}

/** Update the labels of any vault category. The ID is immutable. */
export async function updateCustomCategory(
  caller: CallerContext,
  categoryId: string,
  input: { label_en: string; label_ar: string },
  ip?: string | null
): Promise<CustomVaultCategory[]> {
  const existing = await listCustomCategories(caller.schoolId)
  const idx = existing.findIndex(c => c.id === categoryId)
  if (idx === -1) {
    throw new Error(`Category "${categoryId}" not found`)
  }
  const updated = existing.map((c, i) =>
    i === idx ? { ...c, label_en: input.label_en, label_ar: input.label_ar } : c
  )
  await persistCategories(caller.schoolId, updated)
  await logVaultAuditFromCaller(caller, 'category.updated', {
    subjectType: 'vault_category',
    subjectId: categoryId,
    meta: { label_en: input.label_en },
    ip,
  })
  return updated
}
