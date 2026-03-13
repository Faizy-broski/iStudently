/**
 * Public Pages API — no authentication required for GET endpoints.
 * Admin config endpoints (GET/PUT /config/settings) use a token.
 */
import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

// ============================================================================
// TYPES
// ============================================================================

export type PublicPageId = 'school' | 'events' | 'marking-periods' | 'courses' | 'activities' | 'staff' | 'custom'

export interface PublicPagesConfig {
  /** Activation is controlled by active_plugins.public_pages in school_settings (via Plugins page) */
  pages: PublicPageId[]
  default_page: PublicPageId | 'login'
  custom_page_title: string
  custom_page_content: string
}

export interface PublicSchoolInfo {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  phone: string | null
  website: string | null
  principal_name: string | null
  short_name: string | null
  school_number: string | null
}

export interface PublicEvent {
  id: string
  title: string
  description: string | null
  category: string
  start_at: string
  end_at: string
  is_all_day: boolean
  color_code: string
}

export interface PublicMarkingPeriod {
  id: string
  title: string
  short_name: string
  mp_type: 'FY' | 'SEM' | 'QTR' | 'PRO'
  start_date: string | null
  end_date: string | null
  sort_order: number
}

export interface PublicCourse {
  id: string
  title: string
  short_name: string | null
  credit_hours: number | null
  subject: { name: string; code: string; subject_type: string } | null
}

export interface PublicActivity {
  id: string
  title: string
  start_date: string | null
  end_date: string | null
  comment: string | null
}

export interface PublicStaffMember {
  id: string
  role: string
  employee_number: string | null
  profile: {
    first_name: string
    last_name: string
    father_name: string | null
    profile_photo_url: string | null
    email: string | null
  } | null
}

// ============================================================================
// UNAUTHENTICATED FETCH (public data)
// ============================================================================

async function publicFetch<T>(path: string): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const json = await res.json()
    if (!res.ok) return { success: false, error: json.error || `Request failed (${res.status})` }
    return json
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return { success: false, error: msg }
  }
}

// ============================================================================
// AUTHENTICATED FETCH (admin config)
// ============================================================================

async function authFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required' }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const json = await res.json()
    if (res.status === 401) { await handleSessionExpiry(); return { success: false, error: 'Session expired' } }
    if (!res.ok) return { success: false, error: json.error || `Request failed (${res.status})` }
    return json
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Network error'
    return { success: false, error: msg }
  }
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

export async function getPublicSchool(slug: string) {
  return publicFetch<{ school: PublicSchoolInfo; config: Omit<PublicPagesConfig, 'custom_page_content'> }>(`/public/${slug}`)
}

export async function getPublicEvents(slug: string) {
  return publicFetch<PublicEvent[]>(`/public/${slug}/events`)
}

export async function getPublicMarkingPeriods(slug: string) {
  return publicFetch<PublicMarkingPeriod[]>(`/public/${slug}/marking-periods`)
}

export async function getPublicCourses(slug: string) {
  return publicFetch<PublicCourse[]>(`/public/${slug}/courses`)
}

export async function getPublicActivities(slug: string) {
  return publicFetch<PublicActivity[]>(`/public/${slug}/activities`)
}

export async function getPublicStaff(slug: string) {
  return publicFetch<PublicStaffMember[]>(`/public/${slug}/staff`)
}

export async function getPublicCustomPage(slug: string) {
  return publicFetch<{ title: string; content: string }>(`/public/${slug}/custom`)
}

// ============================================================================
// ADMIN CONFIG API FUNCTIONS
// ============================================================================

export async function getPublicPagesSettings() {
  return authFetch<{ config: PublicPagesConfig; available_pages: { id: PublicPageId; label: string }[] }>(
    '/public/config/settings'
  )
}

export async function savePublicPagesSettings(config: PublicPagesConfig) {
  return authFetch<PublicPagesConfig>('/public/config/settings', {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

// ============================================================================
// HELPERS
// ============================================================================

export const ALL_PUBLIC_PAGES: { id: PublicPageId; label: string }[] = [
  { id: 'school', label: 'School' },
  { id: 'events', label: 'Events' },
  { id: 'marking-periods', label: 'Marking Periods' },
  { id: 'courses', label: 'Courses' },
  { id: 'activities', label: 'Activities' },
  { id: 'staff', label: 'Staff' },
  { id: 'custom', label: 'Custom' },
]

export function formatEventDate(start: string, end: string, isAllDay: boolean): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = isAllDay
    ? { month: 'short', day: 'numeric', year: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  if (s.toDateString() === e.toDateString()) return s.toLocaleDateString('en-US', opts)
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', opts)}`
}

export function mpTypeLabel(type: string): string {
  return { FY: 'Full Year', SEM: 'Semester', QTR: 'Quarter', PRO: 'Progress' }[type] ?? type
}

export function staffDisplayName(member: PublicStaffMember): string {
  const p = member.profile
  if (!p) return 'Unknown'
  return [p.first_name, p.last_name].filter(Boolean).join(' ')
}
