// Edu Resources (school admin): resource links + categories, resource dashboards, school
// inventory + snapshots, physics labs, embedded resources. Same endpoints as the web's
// lib/api/{resource-links,resource-link-categories,dashboards,school-inventory,physics-labs,
// embedded-resources,embedded-resource-categories}.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

// ── Resource links ───────────────────────────────────────────────────────────

export interface ResourceLink {
  id: string
  school_id: string
  campus_id?: string
  title: string
  url: string
  /** Roles: admin, teacher, student, parent, librarian. */
  visible_to: string[]
  /** Student/parent grade sub-filter (empty = all). */
  visible_to_grade_ids: string[]
  /** Student section sub-filter (takes priority over grade). */
  visible_to_section_ids: string[]
  /** Teacher sub-filter (empty = all teachers). */
  visible_to_teacher_ids: string[]
  /** Specific student record ids (empty = all in the section/grade). */
  visible_to_student_ids: string[]
  sort_order?: number
  category_id?: string | null
  created_at: string
  updated_at: string
}

export type ResourceLinkInput = Pick<ResourceLink, 'title' | 'url' | 'visible_to' | 'visible_to_grade_ids' | 'visible_to_section_ids' | 'visible_to_teacher_ids' | 'visible_to_student_ids'> & {
  id?: string
  sort_order?: number
  category_id?: string | null
}

export interface ResourceLinkCategory {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  sort_order?: number
}

// ── Resource dashboards ──────────────────────────────────────────────────────

export interface ResourceDashboard {
  id: string
  school_id: string
  campus_id?: string
  title: string
  description?: string
  is_active: boolean
  sort_order?: number
  created_at: string
  updated_at: string
  /** Included by GET /resource-dashboards/:id. */
  dashboard_elements?: DashboardElement[]
  elements?: DashboardElement[]
}

export interface DashboardElement {
  id: string
  dashboard_id: string
  type: string
  /** Internal Studently path ("/admin/...") or an external URL. */
  url: string
  title?: string
  width_percent: number
  height_px: number
  sort_order?: number
  refresh_minutes?: number | null
  custom_css?: string | null
}

export interface DashboardElementInput {
  url?: string
  title?: string
  width_percent?: number
  height_px?: number
  sort_order?: number | null
  refresh_minutes?: number | null
  custom_css?: string | null
}

// ── School inventory ─────────────────────────────────────────────────────────

export type InventoryCategoryType = 'CATEGORY' | 'STATUS' | 'LOCATION' | 'PERSON'

export interface InventoryCategory {
  id: string
  school_id: string
  campus_id?: string
  category_type: InventoryCategoryType
  title: string
  sort_order?: number
  color?: string
  item_count?: number
}

export interface InventoryItem {
  id: string
  school_id: string
  campus_id?: string
  title: string
  quantity: number
  comments?: string
  sort_order?: number
  categories?: InventoryCategory[]
}

export interface InventorySnapshot {
  id: string
  school_id: string
  campus_id?: string
  title: string
  created_at: string
}

export interface InventorySnapshotDetail extends InventorySnapshot {
  items: { id: string; original_item_id?: string; title: string; quantity: number; comments?: string; sort_order?: number; categories: { id: string; category_type: InventoryCategoryType; title: string }[] }[]
}

// ── Physics labs ─────────────────────────────────────────────────────────────

/** A myphysicslab simulation assigned to a grade/section (catalog: shared-utils PHYSICS_CATALOG). */
export interface PhysicsLab {
  id: string
  school_id: string
  sim_key: string
  subject_id: string | null
  grade_id: string | null
  section_id: string | null
  custom_note: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PhysicsLabSubmission {
  id: string
  lab_id: string
  student_id: string
  findings_text: string
  time_spent_s: number | null
  submitted_at: string
  profiles?: { first_name: string; last_name: string; grade_levels?: { name: string } | null } | null
}

// ── Embedded resources ───────────────────────────────────────────────────────

export interface EmbeddedResource {
  id: string
  school_id: string
  title: string
  url: string
  /** Students in these grades (empty = all). */
  published_grade_ids: string[]
  /** Students in these sections (overrides grade when set). */
  published_section_ids: string[]
  /** Empty = all roles. */
  visible_to_roles: string[]
  visible_to_teacher_ids: string[]
  visible_to_student_ids: string[]
  is_active: boolean
  sort_order: number
  category_id?: string | null
}

export type EmbeddedResourceInput = Pick<EmbeddedResource, 'title' | 'url' | 'published_grade_ids' | 'published_section_ids' | 'visible_to_roles' | 'visible_to_teacher_ids' | 'visible_to_student_ids' | 'sort_order'> & {
  category_id?: string | null
  is_active?: boolean
}

export interface EmbeddedResourceCategory {
  id: string
  school_id: string
  name: string
  sort_order?: number
}

export function adminResourcesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    links: (campusId?: string) => api.get<ResourceLink[]>(`/resource-links${qs({ campus_id: campusId })}`),
    /** Saves the whole list: rows with an id are updated, new ones created, `existingIds` missing from `links` deleted. */
    saveLinks: (links: ResourceLinkInput[], existingIds: string[]) => api.put<ResourceLink[]>('/resource-links/bulk-save', { links, existing_ids: existingIds }),
    linkCategories: (campusId?: string) => api.get<ResourceLinkCategory[]>(`/resource-link-categories${qs({ campus_id: campusId })}`),
    createLinkCategory: (body: { name: string; campus_id?: string | null; sort_order?: number }) => api.post<ResourceLinkCategory>('/resource-link-categories', body),
    updateLinkCategory: (categoryId: string, body: { name?: string; sort_order?: number }) => api.put<ResourceLinkCategory>(`/resource-link-categories/${id(categoryId)}`, body),
    deleteLinkCategory: (categoryId: string) => api.del<void>(`/resource-link-categories/${id(categoryId)}`),

    dashboards: (campusId?: string) => api.get<ResourceDashboard[]>(`/resource-dashboards${qs({ campus_id: campusId })}`),
    dashboard: (dashboardId: string) => api.get<ResourceDashboard>(`/resource-dashboards/${id(dashboardId)}`),
    createDashboard: (body: { title: string; description?: string; campus_id?: string }) => api.post<ResourceDashboard>('/resource-dashboards', body),
    updateDashboard: (dashboardId: string, body: { title?: string; description?: string; is_active?: boolean; sort_order?: number }) => api.put<ResourceDashboard>(`/resource-dashboards/${id(dashboardId)}`, body),
    deleteDashboard: (dashboardId: string) => api.del<void>(`/resource-dashboards/${id(dashboardId)}`),
    elements: (dashboardId: string) => api.get<DashboardElement[]>(`/resource-dashboards/${id(dashboardId)}/elements`),
    addElement: (dashboardId: string, body: DashboardElementInput & { url: string }) => api.post<DashboardElement>(`/resource-dashboards/${id(dashboardId)}/elements`, body),
    updateElement: (dashboardId: string, elementId: string, body: DashboardElementInput) => api.put<DashboardElement>(`/resource-dashboards/${id(dashboardId)}/elements/${id(elementId)}`, body),
    deleteElement: (dashboardId: string, elementId: string) => api.del<void>(`/resource-dashboards/${id(dashboardId)}/elements/${id(elementId)}`),
    inventoryCategories: (campusId?: string, type?: InventoryCategoryType) => api.get<InventoryCategory[]>(`/school-inventory/categories${qs({ campus_id: campusId, type })}`),
    /** Saves one type's categories (rows with an id updated, new created, missing `existingIds` deleted). */
    saveInventoryCategories: (categories: { id?: string; category_type: InventoryCategoryType; title: string; sort_order?: number; color?: string }[], existingIds: string[], campusId?: string) =>
      api.put<InventoryCategory[]>('/school-inventory/categories/bulk-save', { categories, existing_ids: existingIds, campus_id: campusId }),
    deleteInventoryCategory: (categoryId: string) => api.del<void>(`/school-inventory/categories/${id(categoryId)}`),
    inventoryItems: (campusId?: string, categoryId?: string) => api.get<InventoryItem[]>(`/school-inventory/items${qs({ campus_id: campusId, category_id: categoryId })}`),
    saveInventoryItems: (items: { id?: string; title: string; quantity?: number; comments?: string; sort_order?: number; category_ids?: string[] }[], existingIds: string[], campusId?: string) =>
      api.put<InventoryItem[]>('/school-inventory/items/bulk-save', { items, existing_ids: existingIds, campus_id: campusId }),
    deleteInventoryItem: (itemId: string) => api.del<void>(`/school-inventory/items/${id(itemId)}`),
    snapshots: (campusId?: string) => api.get<InventorySnapshot[]>(`/school-inventory/snapshots${qs({ campus_id: campusId })}`),
    snapshot: (snapshotId: string) => api.get<InventorySnapshotDetail>(`/school-inventory/snapshots/${id(snapshotId)}`),
    createSnapshot: (title: string, campusId?: string) => api.post<InventorySnapshot>('/school-inventory/snapshots', { title, campus_id: campusId }),
    deleteSnapshot: (snapshotId: string) => api.del<void>(`/school-inventory/snapshots/${id(snapshotId)}`),

    /** `schoolId` is the selected campus (or the main school), as the web sends it. */
    physicsLabs: (schoolId: string) => api.get<PhysicsLab[]>(`/physics-labs${qs({ school_id: schoolId })}`),
    assignPhysicsLab: (body: { sim_key: string; school_id: string; grade_id: string | null; section_id: string | null; subject_id: string | null; custom_note: string | null }) => api.post<PhysicsLab>('/physics-labs', body),
    updatePhysicsLab: (labId: string, schoolId: string, body: { grade_id: string | null; section_id: string | null; subject_id: string | null; custom_note: string | null; is_active: boolean }) =>
      api.put<PhysicsLab>(`/physics-labs/${id(labId)}${qs({ school_id: schoolId })}`, body),
    unassignPhysicsLab: (labId: string, schoolId: string) => api.del<void>(`/physics-labs/${id(labId)}${qs({ school_id: schoolId })}`),
    physicsLabSubmissions: (labId: string, schoolId: string) => api.get<PhysicsLabSubmission[]>(`/physics-labs/${id(labId)}/submissions${qs({ school_id: schoolId })}`),

    /** `schoolId` = the selected campus, sent as ?school_id like the web. */
    embedded: (schoolId?: string) => api.get<EmbeddedResource[]>(`/embedded-resources${qs({ school_id: schoolId })}`),
    createEmbedded: (body: EmbeddedResourceInput, campusId?: string) => api.post<EmbeddedResource>('/embedded-resources', { ...body, campus_id: campusId }),
    updateEmbedded: (resourceId: string, body: Partial<EmbeddedResourceInput>, schoolId?: string) => api.put<EmbeddedResource>(`/embedded-resources/${id(resourceId)}${qs({ school_id: schoolId })}`, body),
    deleteEmbedded: (resourceId: string, schoolId?: string) => api.del<void>(`/embedded-resources/${id(resourceId)}${qs({ school_id: schoolId })}`),
    embeddedCategories: (schoolId?: string) => api.get<EmbeddedResourceCategory[]>(`/embedded-resource-categories${qs({ school_id: schoolId })}`),
    createEmbeddedCategory: (body: { name: string; sort_order?: number }, schoolId?: string) =>
      api.post<EmbeddedResourceCategory>(`/embedded-resource-categories${qs({ school_id: schoolId })}`, { ...body, campus_id: schoolId, school_id: schoolId }),
    updateEmbeddedCategory: (categoryId: string, body: { name?: string; sort_order?: number }, schoolId?: string) =>
      api.put<EmbeddedResourceCategory>(`/embedded-resource-categories/${id(categoryId)}${qs({ school_id: schoolId })}`, body),
    deleteEmbeddedCategory: (categoryId: string, schoolId?: string) => api.del<void>(`/embedded-resource-categories/${id(categoryId)}${qs({ school_id: schoolId })}`),

    reorderElements: (dashboardId: string, elements: { id: string; sort_order: number }[]) => api.put<void>(`/resource-dashboards/${id(dashboardId)}/elements/reorder`, { elements }),
  }
}
