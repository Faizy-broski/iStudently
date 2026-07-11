import { CustomField } from '@/types'
import { customFieldsApi } from '@/lib/api/custom-fields'
import { saveFieldOrders, type EntityType as FieldOrderEntityType } from '@/lib/utils/field-ordering'

export interface DefaultFieldMeta {
  label: string
  sort_order: number
  // Stable field identifier (matches the registration form's field id, e.g.
  // 'firstName') used for saving/matching order & required overrides.
  // Optional for entity types that haven't been wired up to a registration
  // form's field ids yet — falls back to matching on `label` (fragile, since
  // `label` there is just a display string, but preserves prior behavior).
  id?: string
  required?: boolean
}

export type MergedFieldItem =
  | { key: string; kind: 'default'; label: string; sort_order: number; id?: string; required?: boolean }
  | { key: string; kind: 'custom'; label: string; sort_order: number; field: CustomField }

// Builds one combined, sort_order-ordered list out of the default fields and
// custom fields for a category — the same merge the real registration form
// (getMergedFields) does, so what an admin arranges here matches what
// students/staff/parents/teachers see when filling the form.
export function buildMergedItems(
  defaultFields: DefaultFieldMeta[],
  customFields: CustomField[]
): MergedFieldItem[] {
  const items: MergedFieldItem[] = [
    ...defaultFields.map((f) => ({
      key: `default:${f.label}`,
      kind: 'default' as const,
      label: f.label,
      sort_order: f.sort_order,
      id: f.id,
      required: f.required,
    })),
    ...customFields.map((f) => ({
      key: `custom:${f.id}`,
      kind: 'custom' as const,
      label: f.label,
      sort_order: f.sort_order ?? 1000,
      field: f,
    })),
  ]
  return items.sort((a, b) => a.sort_order - b.sort_order)
}

// Splits a dragged merged order into the two payloads each backend table needs,
// assigning every item its absolute position (1..N) in the combined list —
// not a rank within its own subset — so the two independently-stored
// sequences (default_field_orders, custom_field_definitions.sort_order)
// stay numerically consistent with each other.
export function splitMergedOrder(items: MergedFieldItem[]): {
  defaultOrder: { field_label: string; sort_order: number }[]
  customOrder: { id: string; sort_order: number }[]
} {
  const defaultOrder: { field_label: string; sort_order: number }[] = []
  const customOrder: { id: string; sort_order: number }[] = []

  items.forEach((item, idx) => {
    const sort_order = idx + 1
    if (item.kind === 'default') {
      defaultOrder.push({ field_label: item.id ?? item.label, sort_order })
    } else {
      customOrder.push({ id: item.field.id, sort_order })
    }
  })

  return { defaultOrder, customOrder }
}

export async function saveMergedOrder(
  entityType: FieldOrderEntityType,
  categoryId: string,
  items: MergedFieldItem[],
  campusId?: string
): Promise<{ success: boolean; error?: string }> {
  const { defaultOrder, customOrder } = splitMergedOrder(items)

  const [defaultResult, customResult] = await Promise.all([
    defaultOrder.length
      ? saveFieldOrders(entityType, categoryId, defaultOrder, campusId)
      : Promise.resolve({ success: true }),
    // Custom fields with a temp/unsaved id (not yet created in the DB) can't
    // be reordered server-side yet — their position is still captured
    // locally and will be written on the next full save.
    customOrder.filter((c) => !c.id.startsWith('field-')).length
      ? customFieldsApi.reorderFields(
          categoryId,
          customOrder.filter((c) => !c.id.startsWith('field-'))
        )
      : Promise.resolve({ success: true }),
  ])

  if (!defaultResult.success) {
    return { success: false, error: (defaultResult as { error?: string; message?: string }).error || (defaultResult as { message?: string }).message }
  }
  if (!customResult.success) {
    return { success: false, error: (customResult as { error?: string }).error }
  }
  return { success: true }
}
