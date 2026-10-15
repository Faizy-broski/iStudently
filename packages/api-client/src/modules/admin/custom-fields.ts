// Custom field definitions per entity (backend/src/routes/custom-fields.routes.ts). Values live on
// the record: record.custom_fields[category_id][field_key].
import type { CampusScope, CustomFieldType } from '@studently/shared-types'

import type { ApiClient } from '../../client'
import { qs } from '../../query'

/** hostel_* fields keep values flat by field_key on the row (one 'general' category). */
export type CustomFieldEntity = 'student' | 'teacher' | 'staff' | 'parent' | 'school' | 'hostel_building' | 'hostel_room'

export interface CustomFieldDefinition {
  id: string
  entity_type: CustomFieldEntity
  category_id: string
  category_name: string
  field_key: string
  label: string
  label_ar?: string | null
  type: CustomFieldType
  options?: string[] | null
  options_ar?: string[] | null
  required: boolean
  sort_order: number
  category_order?: number
  campus_scope?: CampusScope
  applicable_school_ids?: string[] | null
  is_active?: boolean
}

export interface CustomFieldInput {
  category_id: string
  category_name: string
  label: string
  label_ar?: string | null
  type: CustomFieldType
  options?: string[]
  options_ar?: string[]
  required: boolean
  /** The web's hostel field editor leaves it to the server default. */
  campus_scope?: CampusScope
  /** Campuses the field applies to when campus_scope is 'selected_campuses'. */
  applicable_school_ids?: string[]
  sort_order?: number
}

export function adminCustomFieldsApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (entity: CustomFieldEntity, campusId?: string) =>
      api.get<CustomFieldDefinition[]>(`/custom-fields/${id(entity)}${qs({ campus_id: campusId })}`),
    create: (entity: CustomFieldEntity, campusId: string | undefined, input: CustomFieldInput) =>
      api.post<CustomFieldDefinition>(`/custom-fields${qs({ campus_id: campusId })}`, { entity_type: entity, ...input }),
    update: (campusId: string | undefined, fieldId: string, input: Partial<CustomFieldInput>) =>
      api.patch<CustomFieldDefinition>(`/custom-fields/${id(fieldId)}${qs({ campus_id: campusId })}`, input),
    /** Hides the field; values already saved are kept. */
    remove: (campusId: string | undefined, fieldId: string) => api.del<void>(`/custom-fields/${id(fieldId)}${qs({ campus_id: campusId })}`),
    /** Saved tab order for an entity's custom-field tabs (web: custom-field-category-orders). */
    categoryOrders: (entity: CustomFieldEntity, campusId?: string) =>
      api.get<{ category_id: string; category_order: number }[]>(`/custom-field-category-orders/${entity}${qs({ campus_id: campusId })}`),
    saveCategoryOrders: (entity: CustomFieldEntity, categories: { category_id: string; category_order: number }[], campusId?: string) =>
      api.post<void>(`/custom-field-category-orders/${entity}`, { categories, campus_id: campusId }),
    reorder: (campusId: string | undefined, categoryId: string, items: { id: string; sort_order: number }[]) =>
      api.post<void>(`/custom-fields/reorder${qs({ campus_id: campusId })}`, { category_id: categoryId, items }),
  }
}
