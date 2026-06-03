import { supabase } from '../config/supabase'
import crypto from 'crypto'

// ============================================================================
// TYPES
// ============================================================================

export interface CustomLink {
  id: string
  title: string
  url: string
  order: number
  isActive: boolean
}

export interface PublicPagesConfig {
  /** Activation is controlled by school_settings.active_plugins.public_pages — not stored here */
  pages: PublicPageId[]
  default_page: PublicPageId | 'login'
  custom_page_title: string
  custom_page_content: string
  custom_links?: CustomLink[]
}

export type PublicPageId = 'school' | 'events' | 'marking-periods' | 'courses' | 'activities' | 'staff' | 'custom'

export const ALL_PUBLIC_PAGES: { id: PublicPageId; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'events', label: 'Events' },
  { id: 'marking-periods', label: 'Marking Periods' },
  { id: 'courses', label: 'Courses' },
  { id: 'activities', label: 'Activities' },
  { id: 'staff', label: 'Staff' },
  { id: 'custom', label: 'Custom' },
]

export const DEFAULT_PUBLIC_PAGES_CONFIG: PublicPagesConfig = {
  pages: [],
  default_page: 'login',
  custom_page_title: '',
  custom_page_content: '',
}

// ============================================================================
// SCHOOL LOOKUP
// ============================================================================

export async function getSchoolBySlug(slug: string) {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, slug, logo_url, address, city, state, zip_code, phone, website, principal_name, short_name, school_number, status, parent_school_id')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) return null
  return data
}

// ============================================================================
// PUBLIC PAGES CONFIG (stored in school_settings.public_pages jsonb)
// ============================================================================

/** Returns { config, isActive } — isActive is true when active_plugins.public_pages === true */
export async function getPublicPagesConfig(
  schoolId: string,
  campusId?: string | null
): Promise<{ config: PublicPagesConfig; isActive: boolean }> {
  const tryRow = async (matchCampus: string | null) => {
    const q = supabase
      .from('school_settings')
      .select('public_pages, active_plugins')
      .eq('school_id', schoolId)

    const result = matchCampus
      ? await q.eq('campus_id', matchCampus).maybeSingle()
      : await q.is('campus_id', null).maybeSingle()

    return result.data
  }

  const campusRow = campusId ? await tryRow(campusId) : null
  const parentRow = await tryRow(null)

  // isActive from either row (plugin may be toggled on campus or parent row)
  const isActive =
    Boolean(campusRow?.active_plugins?.public_pages) ||
    Boolean(parentRow?.active_plugins?.public_pages)

  // Use campus row config if it has pages configured, otherwise fall back to parent row
  const campusConfig = campusRow?.public_pages as PublicPagesConfig | undefined
  const parentConfig = parentRow?.public_pages as PublicPagesConfig | undefined
  const config: PublicPagesConfig =
    campusConfig?.pages?.length
      ? campusConfig
      : parentConfig ?? { ...DEFAULT_PUBLIC_PAGES_CONFIG }

  return { config, isActive }
}

export async function savePublicPagesConfig(
  schoolId: string,
  config: PublicPagesConfig,
  campusId?: string | null
): Promise<void> {
  const now = new Date().toISOString()

  let existingQuery = supabase
    .from('school_settings')
    .select('id')
    .eq('school_id', schoolId)

  if (campusId) {
    existingQuery = existingQuery.eq('campus_id', campusId)
  } else {
    existingQuery = existingQuery.is('campus_id', null)
  }

  const { data: existing } = await existingQuery.maybeSingle()

  if (existing?.id) {
    await supabase
      .from('school_settings')
      .update({ public_pages: config, updated_at: now })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('school_settings')
      .insert({
        school_id: schoolId,
        campus_id: campusId || null,
        public_pages: config,
        created_at: now,
        updated_at: now,
      })
  }
}

// ============================================================================
// PUBLIC DATA QUERIES (no auth required — slug-based school lookup)
// ============================================================================

export async function getPublicSchoolInfo(schoolId: string) {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, slug, logo_url, address, city, state, zip_code, phone, website, principal_name, short_name, school_number')
    .eq('id', schoolId)
    .maybeSingle()

  if (error || !data) return null
  return data
}

export async function getPublicEvents(schoolId: string, campusId?: string | null) {
  const today = new Date().toISOString()
  const ninetyDaysOut = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  let query = supabase
    .from('school_events')
    .select('id, title, description, category, start_at, end_at, is_all_day, color_code')
    .eq('school_id', schoolId)
    .gte('end_at', today)
    .lte('start_at', ninetyDaysOut)
    .order('start_at', { ascending: true })
    .limit(50)

  if (campusId) {
    query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data, error } = await query
  if (error) return []
  return data || []
}

export async function getPublicMarkingPeriods(schoolId: string, campusId?: string | null) {
  let query = supabase
    .from('marking_periods')
    .select('id, title, short_name, mp_type, start_date, end_date, sort_order')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true })

  if (campusId) {
    query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data, error } = await query
  if (error) return []
  return data || []
}

export async function getPublicCourses(schoolId: string, campusId?: string | null) {
  let query = supabase
    .from('courses')
    .select('id, title, short_name, credit_hours, subject:subjects(name, code, subject_type)')
    .eq('school_id', schoolId)
    .order('title', { ascending: true })

  if (campusId) {
    query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('[public-pages] getPublicCourses error:', error.message, { schoolId, campusId }); return [] }
  return data || []
}

export async function getPublicActivities(schoolId: string, campusId?: string | null) {
  let query = supabase
    .from('activities')
    .select('id, title, start_date, end_date, comment')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('start_date', { ascending: true })

  if (campusId) {
    query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data, error } = await query
  if (error) return []
  return data || []
}

// ============================================================================
// CUSTOM LINKS CRUD (Super Admin manages per-school external link tabs)
// ============================================================================

/** Read existing raw config row for a school (parent row, campus_id IS NULL) */
async function getRawSettingsRow(schoolId: string): Promise<{ id: string | null; config: PublicPagesConfig }> {
  const { data } = await supabase
    .from('school_settings')
    .select('id, public_pages')
    .eq('school_id', schoolId)
    .is('campus_id', null)
    .maybeSingle()

  const config: PublicPagesConfig = (data?.public_pages as PublicPagesConfig) ?? { ...DEFAULT_PUBLIC_PAGES_CONFIG }
  return { id: data?.id ?? null, config }
}

async function persistConfig(schoolId: string, rowId: string | null, config: PublicPagesConfig): Promise<void> {
  const now = new Date().toISOString()
  if (rowId) {
    await supabase.from('school_settings').update({ public_pages: config, updated_at: now }).eq('id', rowId)
  } else {
    await supabase.from('school_settings').insert({ school_id: schoolId, campus_id: null, public_pages: config, created_at: now, updated_at: now })
  }
}

export async function getCustomLinks(schoolId: string): Promise<CustomLink[]> {
  const { config } = await getRawSettingsRow(schoolId)
  return (config.custom_links ?? []).sort((a, b) => a.order - b.order)
}

export async function addCustomLink(
  schoolId: string,
  data: { title: string; url: string; isActive: boolean }
): Promise<CustomLink> {
  const { id: rowId, config } = await getRawSettingsRow(schoolId)
  const links: CustomLink[] = config.custom_links ?? []
  const newLink: CustomLink = {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    url: data.url.trim(),
    isActive: data.isActive,
    order: links.length,
  }
  config.custom_links = [...links, newLink]
  await persistConfig(schoolId, rowId, config)
  return newLink
}

export async function updateCustomLink(
  schoolId: string,
  pageId: string,
  data: Partial<{ title: string; url: string; isActive: boolean }>
): Promise<CustomLink> {
  const { id: rowId, config } = await getRawSettingsRow(schoolId)
  const links: CustomLink[] = config.custom_links ?? []
  const idx = links.findIndex((l) => l.id === pageId)
  if (idx === -1) throw new Error('Custom page not found')

  const updated = {
    ...links[idx],
    ...(data.title !== undefined ? { title: data.title.trim() } : {}),
    ...(data.url !== undefined ? { url: data.url.trim() } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  }
  links[idx] = updated
  config.custom_links = links
  await persistConfig(schoolId, rowId, config)
  return updated
}

export async function deleteCustomLink(schoolId: string, pageId: string): Promise<void> {
  const { id: rowId, config } = await getRawSettingsRow(schoolId)
  const links: CustomLink[] = config.custom_links ?? []
  config.custom_links = links.filter((l) => l.id !== pageId).map((l, i) => ({ ...l, order: i }))
  await persistConfig(schoolId, rowId, config)
}

export async function reorderCustomLinks(schoolId: string, orderedIds: string[]): Promise<CustomLink[]> {
  const { id: rowId, config } = await getRawSettingsRow(schoolId)
  const links: CustomLink[] = config.custom_links ?? []
  const map = new Map(links.map((l) => [l.id, l]))
  const reordered = orderedIds
    .map((id, i) => (map.has(id) ? { ...map.get(id)!, order: i } : null))
    .filter(Boolean) as CustomLink[]
  config.custom_links = reordered
  await persistConfig(schoolId, rowId, config)
  return reordered
}

/** Resolve the primary school id (first active parent school) */
async function getPrimarySchoolId(): Promise<string | null> {
  const { data } = await supabase
    .from('schools')
    .select('id')
    .is('parent_school_id', null)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/** Public endpoint — returns active custom links for login page. No auth required. */
export async function getLoginLinks(): Promise<CustomLink[]> {
  const schoolId = await getPrimarySchoolId()
  if (!schoolId) return []
  const links = await getCustomLinks(schoolId)
  return links.filter((l) => l.isActive)
}

// ============================================================================
// GLOBAL CUSTOM LINKS — Super Admin manages globally (no school context in UI)
// Internally stored under the primary school, but the admin never sees school_id
// ============================================================================

export async function getGlobalCustomLinks(): Promise<CustomLink[]> {
  const schoolId = await getPrimarySchoolId()
  if (!schoolId) return []
  return getCustomLinks(schoolId)
}

export async function addGlobalCustomLink(
  data: { title: string; url: string; isActive: boolean }
): Promise<CustomLink> {
  const schoolId = await getPrimarySchoolId()
  if (!schoolId) throw new Error('No active school found')
  return addCustomLink(schoolId, data)
}

export async function updateGlobalCustomLink(
  pageId: string,
  data: Partial<{ title: string; url: string; isActive: boolean }>
): Promise<CustomLink> {
  const schoolId = await getPrimarySchoolId()
  if (!schoolId) throw new Error('No active school found')
  return updateCustomLink(schoolId, pageId, data)
}

export async function deleteGlobalCustomLink(pageId: string): Promise<void> {
  const schoolId = await getPrimarySchoolId()
  if (!schoolId) throw new Error('No active school found')
  return deleteCustomLink(schoolId, pageId)
}

export async function reorderGlobalCustomLinks(orderedIds: string[]): Promise<CustomLink[]> {
  const schoolId = await getPrimarySchoolId()
  if (!schoolId) throw new Error('No active school found')
  return reorderCustomLinks(schoolId, orderedIds)
}

export async function getPublicStaff(schoolId: string, campusId?: string | null) {
  let query = supabase
    .from('staff')
    .select(`
      id,
      role,
      employee_number,
      profile:profiles!staff_profile_id_fkey(
        first_name, last_name, father_name, profile_photo_url, email
      )
    `)
    .eq('school_id', schoolId)
    .in('role', ['teacher', 'admin'])
    .eq('is_active', true)
    .order('role', { ascending: false })

  if (campusId) {
    query = query.or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data, error } = await query
  if (error) { console.error('[public-pages] getPublicStaff error:', error.message, { schoolId, campusId }); return [] }
  console.log('[public-pages] getPublicStaff result:', { schoolId, campusId, count: data?.length })
  return data || []
}
