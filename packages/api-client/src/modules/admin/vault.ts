// AdminVault (plugin): confidential school records by category with custom fields, secret
// fields revealed on demand, and watermarked attachments. Same endpoints as
// frontend/src/lib/api/vault.ts; routers: vault/{records,field-definitions,media,categories}.routes.ts.
// Every call carries campus_id so the plugin check reads the selected campus's settings.
// Callers without access get a uniform 404, by design.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { UploadFile } from '../../types'

export type VaultFieldType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'encrypted_text' | 'file'

export const VAULT_CATEGORIES: { value: string; label: string; label_ar: string }[] = [
  { value: 'facility_utilities', label: 'Facility & Utilities', label_ar: 'المرافق والخدمات' },
  { value: 'legal_licensing', label: 'Legal & Licensing', label_ar: 'الشؤون القانونية والتراخيص' },
  { value: 'financial_procurement', label: 'Financial & Procurement', label_ar: 'الشؤون المالية والمشتريات' },
  { value: 'it_security', label: 'IT & Security', label_ar: 'تقنية المعلومات والأمن' },
  { value: 'hr_confidential', label: 'HR Confidential', label_ar: 'الموارد البشرية (سري)' },
]

export interface VaultCustomCategory {
  id: string
  label_en: string
  label_ar: string
  created_at: string
}

export interface VaultFieldDefinition {
  id: string
  school_id: string
  category: string
  field_key: string
  label_en: string
  label_ar: string
  field_type: VaultFieldType
  options: string[]
  is_required: boolean
  is_secret: boolean
  sort_order: number
}

export interface VaultRecord {
  id: string
  school_id: string
  campus_id: string | null
  category: string
  sub_category: string
  title: string
  default_fields: Record<string, unknown>
  custom_fields: Record<string, unknown>
  attachments: string[]
  expiry_date: string | null
  created_at: string
  updated_at: string
}

export interface VaultRecordInput {
  category: string
  sub_category: string
  title: string
  default_fields?: Record<string, unknown>
  custom_fields?: Record<string, unknown>
  attachments?: string[]
  expiry_date?: string | null
}

export function adminVaultApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    fieldDefinitions: (campusId?: string, category?: string) => api.get<VaultFieldDefinition[]>(`/vault/field-definitions${qs({ category, campus_id: campusId })}`),
    createFieldDefinition: (
      body: { category: string; field_key: string; label_en: string; label_ar: string; field_type: VaultFieldType; options?: string[]; is_required?: boolean; is_secret?: boolean; sort_order?: number },
      campusId?: string,
    ) => api.post<VaultFieldDefinition>(`/vault/field-definitions${qs({ campus_id: campusId })}`, body),
    deleteFieldDefinition: (fieldId: string, campusId?: string) => api.del<void>(`/vault/field-definitions/${id(fieldId)}${qs({ campus_id: campusId })}`),

    records: (campusId?: string, category?: string) => api.get<VaultRecord[]>(`/vault/records${qs({ category, campus_id: campusId })}`),
    record: (recordId: string, campusId?: string) => api.get<VaultRecord>(`/vault/records/${id(recordId)}${qs({ campus_id: campusId })}`),
    createRecord: (body: VaultRecordInput, campusId?: string) => api.post<VaultRecord>(`/vault/records${qs({ campus_id: campusId })}`, body),
    updateRecord: (recordId: string, body: Partial<Omit<VaultRecordInput, 'category'>>, campusId?: string) => api.put<VaultRecord>(`/vault/records/${id(recordId)}${qs({ campus_id: campusId })}`, body),
    deleteRecord: (recordId: string, campusId?: string) => api.del<void>(`/vault/records/${id(recordId)}${qs({ campus_id: campusId })}`),
    revealSecret: (recordId: string, fieldKey: string, campusId?: string) => api.post<{ value: string }>(`/vault/records/${id(recordId)}/reveal-secret${qs({ campus_id: campusId })}`, { field_key: fieldKey }),

    /** Returns a storage key to put in the record's `attachments`. */
    uploadAttachment: (file: UploadFile, campusId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      return api.post<{ storageKey: string }>(`/vault/media/upload${qs({ campus_id: campusId })}`, form, { timeout: 120_000 })
    },
    /** Path (for an authenticated download) of attachment `index` of a record. */
    attachmentPath: (recordId: string, index: number, campusId?: string) => `/vault/media/${id(recordId)}/attachments/${index}${qs({ campus_id: campusId })}`,

    customCategories: (campusId?: string) => api.get<VaultCustomCategory[]>(`/vault/categories${qs({ campus_id: campusId })}`),
    createCustomCategory: (body: { id: string; label_en: string; label_ar: string }, campusId?: string) => api.post<VaultCustomCategory[]>(`/vault/categories${qs({ campus_id: campusId })}`, body),
    updateCustomCategory: (categoryId: string, body: { label_en: string; label_ar: string }, campusId?: string) =>
      api.patch<VaultCustomCategory[]>(`/vault/categories/${id(categoryId)}${qs({ campus_id: campusId })}`, body),
    deleteCustomCategory: (categoryId: string, campusId?: string) => api.del<void>(`/vault/categories/${id(categoryId)}${qs({ campus_id: campusId })}`),
  }
}
