import sidebarSections from './sidebar-sections.json'

/** Roles whose web sidebar section order the school can change (web: /admin/settings/custom-menu). */
export const CUSTOM_MENU_ROLES = ['admin', 'teacher', 'student', 'parent', 'librarian'] as const
export type CustomMenuRole = (typeof CUSTOM_MENU_ROLES)[number]

/** Top-level web sidebar section titles per role in default order (scripts/sync-role-hrefs.sh). */
export const SIDEBAR_SECTIONS: Record<CustomMenuRole, string[]> = sidebarSections

/** Saved order with removed sections dropped and new ones appended (web: CustomMenuPage resolveOrder). */
export function resolveMenuOrder(role: CustomMenuRole, saved?: string[] | null): string[] {
  const defaults = SIDEBAR_SECTIONS[role]
  if (!saved || saved.length === 0) return defaults
  const known = new Set(defaults)
  const ordered = saved.filter((t) => known.has(t))
  const seen = new Set(ordered)
  for (const t of defaults) if (!seen.has(t)) ordered.push(t)
  return ordered
}
