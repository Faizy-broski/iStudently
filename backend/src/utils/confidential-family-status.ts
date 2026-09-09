import { UserRole } from '../types'

export const CONFIDENTIAL_STATUS_READ_ROLES: ReadonlyArray<string> = [
  'admin',
  'super_admin',
  'counselor',
  'teacher'
]

export const CONFIDENTIAL_STATUS_WRITE_ROLES: ReadonlyArray<string> = [
  'admin',
  'super_admin',
  'counselor'
]

/**
 * Can this role view confidential family status?
 * Allowed: admin, super_admin, counselor, teacher.
 * Denied (stripped completely from response): student, parent, and any other role.
 */
export function canReadConfidentialFamilyStatus(role?: string | null): boolean {
  if (!role) return false
  return CONFIDENTIAL_STATUS_READ_ROLES.includes(role)
}

/**
 * Can this role edit confidential family status?
 * Allowed: admin, super_admin, counselor.
 * Denied: teacher, student, parent, etc.
 */
export function canWriteConfidentialFamilyStatus(role?: string | null): boolean {
  if (!role) return false
  return CONFIDENTIAL_STATUS_WRITE_ROLES.includes(role)
}

/**
 * Strips `confidential_family_status` from a student object or array of student objects
 * unless caller's role is allow-listed to read it.
 *
 * Defense-in-depth: If the caller is a student, parent, or unknown role,
 * the property is removed entirely (not set to null/empty, but `delete` / omitted)
 * so it never leaks over the network into browser DevTools.
 */
export function stripConfidentialFamilyStatus<T>(data: T, role?: string | null): T {
  if (!data) return data
  if (canReadConfidentialFamilyStatus(role)) return data

  if (Array.isArray(data)) {
    return data.map(item => stripConfidentialFamilyStatus(item, role)) as unknown as T
  }

  if (typeof data === 'object') {
    const copy = { ...data } as any

    if ('confidential_family_status' in copy) {
      delete copy.confidential_family_status
    }

    // Also strip from embedded student object if present (e.g. attendance records)
    if (copy.student && typeof copy.student === 'object') {
      copy.student = stripConfidentialFamilyStatus(copy.student, role)
    }

    return copy as T
  }

  return data
}
