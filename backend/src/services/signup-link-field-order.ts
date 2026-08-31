import { supabase } from '../config/supabase'

// Ports the same ordering the Custom Fields admin page (/admin/students/
// custom-fields) computes client-side for its merged default+custom field
// drag list — server-side, so the signup-link builder's field picker (and
// the order fields get written into a link's meta.custom_fields[]) matches
// it, instead of the field-registry/fetch order it used before.
//
// Two tables drive this, both already used by the Custom Fields page:
//   - custom_field_category_orders: which category (personal/academic/...)
//     comes before which, per school+entity_type.
//   - default_field_orders: per-field sort_order *within* a category, for
//     built-in fields — school-specific overrides of the hardcoded baseline
//     below (DEFAULT_FIELDS_BY_CATEGORY in that page's frontend source).
// custom_field_definitions carries its own category_id + sort_order
// directly, no lookup needed.

export type SignupEntityType = 'student' | 'parent' | 'teacher' | 'staff'

const DEFAULT_CATEGORY_ORDER = ['personal', 'academic', 'medical', 'family', 'system']

// Only the subset of DEFAULT_FIELDS_BY_CATEGORY (custom-fields/page.tsx)
// that actually corresponds to a PROFILE_FIELD_REGISTRY column or the
// special-cased grade_level field — the signup builder's other default
// fields (First Name, Last Name, Email, Username, Password) stay in their
// existing fixed positions and are never part of this sort (see the plan's
// "deliberately out of scope" note).
const CANDIDATE_DEFAULT_FIELDS: { id: string; category: string; sort_order: number; column: string }[] = [
  { id: 'fatherName', category: 'personal', sort_order: 2, column: 'father_name' },
  { id: 'grandfatherName', category: 'personal', sort_order: 3, column: 'grandfather_name' },
  { id: 'dateOfBirth', category: 'personal', sort_order: 5, column: 'date_of_birth' },
  { id: 'gender', category: 'personal', sort_order: 6, column: 'gender' },
  { id: 'address', category: 'personal', sort_order: 8, column: 'address' },
  { id: 'grade_level_id', category: 'academic', sort_order: 1, column: 'grade_level' },
]

interface SortKey {
  categoryPos: number
  sortOrder: number
}

export interface SignupFieldOrderResolver {
  /** Effective sort key for a PROFILE_FIELD_REGISTRY field, matched by its `column`. Undefined columns (e.g. parent- or staff-specific fields with no Custom Fields page equivalent) fall back to a stable late position. */
  forRegistryColumn(column: string): SortKey
  /** Effective sort key for a school-created custom field — uses its own category_id + sort_order directly. */
  forCustomField(categoryId: string, sortOrder: number): SortKey
}

const FALLBACK_SORT_KEY: SortKey = { categoryPos: DEFAULT_CATEGORY_ORDER.length, sortOrder: 9999 }

export async function buildSignupFieldOrderResolver(
  schoolId: string,
  entityType: SignupEntityType
): Promise<SignupFieldOrderResolver> {
  const [{ data: categoryOrders }, { data: fieldOrders }] = await Promise.all([
    supabase
      .from('custom_field_category_orders')
      .select('category_id, category_order')
      .eq('school_id', schoolId)
      .eq('entity_type', entityType),
    supabase
      .from('default_field_orders')
      .select('category_id, field_label, sort_order')
      .eq('school_id', schoolId)
      .eq('entity_type', entityType),
  ])

  const categoryPosByCategory = new Map<string, number>()
  DEFAULT_CATEGORY_ORDER.forEach((c, idx) => categoryPosByCategory.set(c, idx))
  ;(categoryOrders || []).forEach((row) => categoryPosByCategory.set(row.category_id, row.category_order))

  // field_label here stores the default field's stable `id` (see
  // DEFAULT_FIELDS_BY_CATEGORY's comment in custom-fields/page.tsx —
  // saveMergedOrder writes `item.id ?? item.label`, and every candidate
  // field above has an id), keyed per category since sort_order is only
  // unique within a category, not globally.
  const savedOrderByKey = new Map<string, number>()
  ;(fieldOrders || []).forEach((row) => savedOrderByKey.set(`${row.category_id}:${row.field_label}`, row.sort_order))

  const columnToCandidate = new Map(CANDIDATE_DEFAULT_FIELDS.map((f) => [f.column, f]))

  const categoryPos = (categoryId: string): number =>
    categoryPosByCategory.get(categoryId) ?? DEFAULT_CATEGORY_ORDER.length

  return {
    forRegistryColumn(column: string): SortKey {
      const candidate = columnToCandidate.get(column)
      if (!candidate) return FALLBACK_SORT_KEY
      const saved = savedOrderByKey.get(`${candidate.category}:${candidate.id}`)
      return { categoryPos: categoryPos(candidate.category), sortOrder: saved ?? candidate.sort_order }
    },
    forCustomField(categoryId: string, sortOrder: number): SortKey {
      return { categoryPos: categoryPos(categoryId), sortOrder }
    },
  }
}

export function compareSortKeys(a: SortKey, b: SortKey): number {
  if (a.categoryPos !== b.categoryPos) return a.categoryPos - b.categoryPos
  return a.sortOrder - b.sortOrder
}
