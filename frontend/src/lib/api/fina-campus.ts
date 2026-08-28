/**
 * Appends the currently-selected campus as a `campus_id` query param — the
 * same convention the rest of this platform already uses for a multi-
 * campus admin to tell the backend which campus a request applies to (see
 * lib/api/students.ts). Read directly from localStorage (CampusContext.tsx
 * persists `selectedCampusId` there on every selection) rather than via
 * React context, mirroring how getImpersonationHeaders() reads
 * sessionStorage — this keeps every fina API function a plain function,
 * not a hook, and works even on pages with no CampusProvider (parent/
 * student layouts), where it's simply a harmless no-op: the backend
 * (fina-caller.ts) only consults this param for admin/media_officer/
 * super_admin callers in the first place.
 */
export function withCampusParam(path: string): string {
  if (typeof window === 'undefined') return path
  const campusId = localStorage.getItem('selectedCampusId')
  if (!campusId) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}campus_id=${encodeURIComponent(campusId)}`
}
