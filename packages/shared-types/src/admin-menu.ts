import adminMenu from './admin-menu.json'
import roleMenus from './role-menus.json'

/**
 * The web's admin sidebar (frontend/src/config/sidebar.ts + plugin-injected pages), snapshotted by
 * scripts/sync-role-hrefs.sh. Titles are keys in the `sidebar` translation namespace.
 */
export interface AdminMenuItem {
  title: string
  href: string
  /** Section label inside a group (not a page). */
  label?: boolean
  /** Hidden unless this plugin is active for the school. */
  plugin?: string
}

export interface AdminMenuGroup extends AdminMenuItem {
  /** Empty for a top-level page (e.g. dashboard). */
  items: AdminMenuItem[]
}

export const ADMIN_MENU: AdminMenuGroup[] = adminMenu as AdminMenuGroup[]

export type MenuRole = 'student' | 'parent' | 'teacher' | 'librarian'
/** The student, parent, teacher and librarian web sidebars, same shape as ADMIN_MENU. */
export const ROLE_MENUS: Record<MenuRole, AdminMenuGroup[]> = roleMenus as Record<MenuRole, AdminMenuGroup[]>

export interface ProfilePermission {
  module_key: string
  can_use: boolean
  can_edit: boolean
}

export interface AdminMenuFilter {
  role: 'admin' | 'staff' | MenuRole
  /** school_settings.active_plugins (GET /auth/me `plugins`). */
  plugins: readonly string[]
  /** school_settings.denied_modules (set by super admin); null = unrestricted. */
  deniedModules?: readonly string[] | null
  /** GET /user-profiles/my-permissions; null = no profile assigned. */
  permissions?: readonly ProfilePermission[] | null
  /** school_settings.custom_menu_order.admin (applies with the custom_menu plugin). */
  customOrder?: readonly string[] | null
}

const isPage = (i: AdminMenuItem) => !i.label && i.href !== '#'

/** Section labels with no page before the next label are left out. */
function dropEmptyLabels(items: AdminMenuItem[]) {
  return items.filter((i, k) => {
    if (!i.label) return true
    const next = items.slice(k + 1).find((n) => n.label || isPage(n))
    return !!next && !next.label
  })
}

/**
 * The admin menu a user should see, same steps as the web's DashboardLayout: plugin gates,
 * custom order, the school's deny-list, then the user's profile permissions. Staff with no
 * profile get nothing (the web treats their null permissions as an empty list).
 */
export function filterAdminMenu(f: AdminMenuFilter, menu: AdminMenuGroup[] = ADMIN_MENU): AdminMenuGroup[] {
  const active = new Set(f.plugins)
  const pluginOk = (i: AdminMenuItem) => !i.plugin || active.has(i.plugin)
  const denied = f.deniedModules && f.deniedModules.length > 0 ? new Set(f.deniedModules) : null
  const permissions = f.permissions ?? (f.role === 'staff' ? [] : null)
  const canUse = (href: string) => permissions === null || permissions.some((p) => p.module_key === href && p.can_use)
  const allowed = (i: AdminMenuItem) => pluginOk(i) && (!denied || !denied.has(i.href)) && canUse(i.href)

  // A top-level page (no sub-items) is checked itself; a group needs at least one page left.
  let groups = menu.filter(pluginOk).flatMap((g) => {
    if (g.items.length === 0) return allowed(g) ? [g] : []
    const items = g.items.filter((i) => !isPage(i) || allowed(i))
    return items.some(isPage) ? [{ ...g, items: dropEmptyLabels(items) }] : []
  })

  if (active.has('custom_menu') && f.customOrder && f.customOrder.length > 0) {
    const byTitle = new Map(groups.map((g) => [g.title, g]))
    const ordered: AdminMenuGroup[] = []
    for (const title of f.customOrder) {
      const g = byTitle.get(title)
      if (g) {
        ordered.push(g)
        byTitle.delete(title)
      }
    }
    groups = [...ordered, ...byTitle.values()]
  }
  return groups
}

/** Every page href in the (unfiltered) admin menu. */
export function adminMenuHrefs(menu: AdminMenuGroup[] = ADMIN_MENU): string[] {
  return menu.flatMap((g) => (g.items.length > 0 ? g.items.filter(isPage).map((i) => i.href) : [g.href]))
}

/**
 * Build wave for each admin menu group in the mobile app (plan: school admin, all modules native).
 * 0 = foundation. A test fails when the web adds a group that has no wave yet.
 */
export const ADMIN_GROUP_WAVE: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  dashboard: 0,
  // 1 People
  students: 1, teachers: 1, staff: 1, parents: 1, user_management: 1,
  // 2 Fees & accounting
  student_billing: 2, billing_elements: 2, accounting: 2, salary: 2,
  // 3 Academics
  grades: 3, scheduling: 3, quiz: 3, online_classes: 3, activities: 3,
  // 4 Attendance & discipline
  attendance: 4, staff_absences: 4, discipline: 4, entry_exit: 4, miqat: 4, grievances: 4, inspections: 4, performance_efficiency: 4,
  // 5 School & settings
  school: 5, settings: 5, messaging: 5, email: 5, reports: 5, weather_alerts: 5, training: 5,
  // 6 Resources & services
  resources: 6, library: 6, hostel: 6, my_worksheet: 6, vault: 6,
  // 7 Plugins
  hifzi: 7, fina: 7, hadith_forty: 7, speed_reading: 7,
}
