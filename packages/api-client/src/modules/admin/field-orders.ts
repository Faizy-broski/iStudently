// Per-school standard field settings (backend/src/routes/default-field-order.routes.ts): order and
// whether a built-in form field is required. field_label is the web form's field id.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type FieldOrderEntity = 'student' | 'parent' | 'teacher' | 'staff' | 'school'

export interface DefaultFieldOrder {
  id: string
  entity_type: FieldOrderEntity
  category_id: string
  field_label: string
  sort_order: number
  required?: boolean | null
}

export function adminFieldOrdersApi(api: ApiClient) {
  return {
    list: (entity: FieldOrderEntity, campusId?: string) =>
      api.get<DefaultFieldOrder[]>(`/default-field-orders/${encodeURIComponent(entity)}${qs({ campus_id: campusId })}`),
    /** Positions of built-in fields in one tab (web: saveFieldOrders). */
    save: (entity: FieldOrderEntity, categoryId: string, fields: { field_label: string; sort_order: number }[], campusId?: string) =>
      api.post<unknown>(`/default-field-orders/${encodeURIComponent(entity)}/${encodeURIComponent(categoryId)}`, { fields, campus_id: campusId }),
    /** Make one built-in field required or optional for this school/campus (web: updateFieldRequired). */
    setRequired: (entity: FieldOrderEntity, categoryId: string, fieldLabel: string, required: boolean, sortOrder: number, campusId?: string) =>
      api.post<unknown>(`/default-field-orders/${encodeURIComponent(entity)}/${encodeURIComponent(categoryId)}/required`, { field_label: fieldLabel, required, sort_order: sortOrder, campus_id: campusId }),
    /** Order of the custom-field tabs (web: getCategoryOrders / saveCategoryOrders). */
    categoryOrders: (entity: FieldOrderEntity, campusId?: string) =>
      api.get<{ category_id: string; category_order: number }[]>(`/custom-field-category-orders/${encodeURIComponent(entity)}${qs({ campus_id: campusId })}`),
    saveCategoryOrders: (entity: FieldOrderEntity, categories: { category_id: string; category_order: number }[], campusId?: string) =>
      api.post<unknown>(`/custom-field-category-orders/${encodeURIComponent(entity)}`, { categories, campus_id: campusId }),
  }
}
