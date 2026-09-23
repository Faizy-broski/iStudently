import { getSidebarConfig, type SidebarMenuItem } from '@/config/sidebar'
import { applyPluginInjections } from '@/config/pluginInjection'
import type { UserRole } from '@/types'

/**
 * The catalog of modules a super admin can allow/deny per school
 * (school_settings.allowed_modules) and an admin can grant in a User Profile.
 * Derived from the sidebar so it can never drift from what users actually see.
 *
 * The stored value is always a list of sidebar hrefs. A catalog *item* is one feature
 * (one sidebar title) and can cover several hrefs — e.g. "Virtual Labs" exists once per
 * role (/admin/..., /teacher/..., /student/..., /parent/...) — so it is shown and toggled
 * as a single checkbox.
 */
export interface CatalogItem {
  /** Sidebar title key, translated with the `sidebar` namespace. */
  title: string
  hrefs: string[]
}

export interface CatalogGroup {
  /** Sidebar section title key, or '__root__' for top-level items. */
  title: string
  items: CatalogItem[]
}

// Union every assignable role's sidebar so the allow-list covers whatever an admin could
// pick when building a User Profile for any staff/student/parent.
export const CATALOG_ROLES: UserRole[] = [
  'admin', 'teacher', 'staff', 'librarian', 'student', 'parent', 'media_officer', 'fina_supervisor', 'inspector',
]

let cached: CatalogGroup[] | null = null

export function getModuleCatalog(): CatalogGroup[] {
  if (cached) return cached

  const groups: CatalogGroup[] = []
  const seenHrefs = new Set<string>()

  const addItem = (groupTitle: string, item: SidebarMenuItem) => {
    if (seenHrefs.has(item.href)) return
    seenHrefs.add(item.href)
    let group = groups.find((g) => g.title === groupTitle)
    if (!group) {
      group = { title: groupTitle, items: [] }
      groups.push(group)
    }
    const existing = group.items.find((i) => i.title === item.title)
    if (existing) existing.hrefs.push(item.href)
    else group.items.push({ title: item.title, hrefs: [item.href] })
  }

  for (const role of CATALOG_ROLES) {
    // Staff use the admin shell, so their plugin pages are the admin ones. Every plugin is
    // treated as active here: the catalog is about what a school MAY be given, not what it
    // has switched on today.
    const injectionRole = role === 'staff' ? 'admin' : role
    for (const item of applyPluginInjections(getSidebarConfig(role), injectionRole, () => true)) {
      if (item.isLabel || item.href === '#') continue
      if (item.subItems && item.subItems.length > 0) {
        for (const sub of item.subItems) {
          if (sub.isLabel || sub.href === '#') continue
          addItem(item.title, sub)
        }
        // NOTE: only one level of subItems is walked here. If sidebar.ts ever gains 3-level
        // nesting (sub-sub-items), this loop will silently miss them — add a recursive walk then.
      } else {
        addItem('__root__', item)
      }
    }
  }

  cached = groups
  return groups
}

export function getAllCatalogHrefs(): string[] {
  return getModuleCatalog().flatMap((g) => g.items.flatMap((i) => i.hrefs))
}

/**
 * True when `pathname` matches a known catalog href AND the school's
 * allow-list does not include it. Unknown paths (detail pages, injected items)
 * are never reported as blocked, so the route guard can't lock people out of pages the
 * catalog doesn't describe.
 */
export function isPathBlockedByAllowList(pathname: string, allowed: ReadonlySet<string> | null): boolean {
  if (!allowed) return false
  // Most specific known href wins, so an allowed child of a blocked prefix stays reachable.
  let best: { href: string; allowed: boolean } | null = null
  for (const href of getAllCatalogHrefs()) {
    if (pathname === href || pathname.startsWith(href + '/')) {
      if (!best || href.length > best.href.length) best = { href, allowed: allowed.has(href) }
    }
  }
  return best ? !best.allowed : false
}

/**
 * True when `pathname` matches a known catalog href AND that href is in the school's
 * deny-list (`school_settings.denied_modules`). Unknown paths (detail pages, dynamic
 * routes) are never reported as hidden so the route guard can't lock people out.
 */
export function isPathHidden(pathname: string, denied: ReadonlySet<string>): boolean {
  if (denied.size === 0) return false
  // Most specific known href wins, so a denied parent doesn't hide an allowed child.
  let best: { href: string; denied: boolean } | null = null
  for (const href of getAllCatalogHrefs()) {
    if (pathname === href || pathname.startsWith(href + '/')) {
      if (!best || href.length > best.href.length) best = { href, denied: denied.has(href) }
    }
  }
  return best ? best.denied : false
}

/**
 * Returns every sidebar href for the given role (with all plugins treated as active).
 * Used to compute the permission set for Default Teacher / Default Staff / Default Librarian.
 */
export function getRoleHrefs(role: UserRole): string[] {
  const injRole = (role as string) === 'staff' ? 'admin' : (role as string)
  const items = applyPluginInjections(getSidebarConfig(role), injRole, () => true)
  const hrefs: string[] = []
  for (const item of items) {
    if (item.isLabel || item.href === '#') continue
    if (item.subItems && item.subItems.length > 0) {
      for (const sub of item.subItems) {
        if (!sub.isLabel && sub.href !== '#') hrefs.push(sub.href)
      }
    } else {
      hrefs.push(item.href)
    }
  }
  return hrefs
}
