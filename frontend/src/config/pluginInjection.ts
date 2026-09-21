import { PLUGIN_REGISTRY } from '@/config/plugins'
import type { SidebarMenuItem } from '@/config/sidebar'

/**
 * Merges each active plugin's sidebar items into the matching parent section. This is the
 * single implementation of the sidebar's "plugin injection" step, shared by the sidebar
 * itself, the User Profiles permission picker and the super-admin module catalog — so what
 * an admin can grant is exactly what the sidebar can show. Previously the picker/catalog
 * only read the static sidebar and silently missed every plugin-provided page (attendance
 * summary/print sheets, email/SMTP/2FA/PDF settings, Human Atlas, Embedded Resources...).
 *
 * `role` is the role whose sidebar is being built. Injections with no `roles` field apply
 * to the admin sidebar only (legacy behaviour).
 */
export function applyPluginInjections(
  items: SidebarMenuItem[],
  role: string,
  isPluginActive: (pluginId: string) => boolean
): SidebarMenuItem[] {
  let result = items
  for (const plugin of PLUGIN_REGISTRY) {
    if (!isPluginActive(plugin.id)) continue
    for (const injection of plugin.sidebarInjections) {
      const targetRoles = injection.roles && injection.roles.length > 0 ? injection.roles : ['admin']
      if (!targetRoles.includes(role)) continue
      result = result.map((item) => {
        if (item.title.toLowerCase() === injection.parentTitle.toLowerCase() && item.subItems) {
          const existingHrefs = new Set(item.subItems.map((s) => s.href))
          const newItems = injection.items.filter((ni) => !existingHrefs.has(ni.href))
          if (newItems.length === 0) return item
          return { ...item, subItems: [...item.subItems, ...newItems] }
        }
        return item
      })
    }
  }
  return result
}
