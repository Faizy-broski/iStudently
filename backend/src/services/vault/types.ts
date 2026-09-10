/**
 * Shared types for the AdminVault module's service layer. Mirrors the
 * CallerContext { profileId, role, schoolId } shape established by
 * backend/src/services/fina/types.ts, kept as its own copy rather than
 * importing from that unrelated module.
 */
export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
  campusId?: string | null
}

export type VaultCategory =
  | 'facility_utilities'
  | 'legal_licensing'
  | 'financial_procurement'
  | 'it_security'
  | 'hr_confidential'

export const VAULT_CATEGORIES: VaultCategory[] = [
  'facility_utilities',
  'legal_licensing',
  'financial_procurement',
  'it_security',
  'hr_confidential',
]

export type VaultFieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'encrypted_text' | 'file'

export const VAULT_FIELD_TYPES: VaultFieldType[] = ['text', 'number', 'date', 'select', 'multi_select', 'encrypted_text', 'file']

export interface VaultFieldDefinition {
  id: string
  school_id: string
  category: VaultCategory
  field_key: string
  label_en: string
  label_ar: string
  field_type: VaultFieldType
  options: string[]
  is_required: boolean
  is_secret: boolean
  sort_order: number
  created_at: string
}

export interface VaultRecord {
  id: string
  school_id: string
  campus_id: string | null
  category: VaultCategory
  sub_category: string
  title: string
  default_fields: Record<string, unknown>
  custom_fields: Record<string, unknown>
  attachments: string[]
  expiry_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** The AdminVault-allowed roles — kept in one place so the RBAC guard and any UI role checks stay in sync. */
export const VAULT_ALLOWED_ROLES = ['super_admin', 'admin', 'financial_admin']
