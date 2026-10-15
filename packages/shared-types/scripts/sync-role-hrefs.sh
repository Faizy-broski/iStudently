#!/bin/sh
# Snapshots computed by the web's own code (frontend/src/config/moduleCatalog.ts):
#  - default-role-hrefs.json: default pages per staff role (getRoleHrefs), used when the app
#    onboards a school (POST /user-profiles/seed-defaults)
#  - module-catalog.json: module groups/items/hrefs (getModuleCatalog), used by the super admin
#    "module access" screen (school-settings denied-modules)
#  - admin-menu.json: the admin sidebar (+ plugin-injected pages), filtered in the app like the web
#  - role-menus.json: the same for student, parent, teacher and librarian
#  - sidebar-sections.json: top-level sidebar section titles per role (Custom Menu order)
#  - profile-modules.json: per user type, the module groups the web's User Profiles page lists
#    (/admin/settings/user-profiles getModuleGroups, before the school's denied modules)
# Re-run after changing the web sidebar/plugins:
#   sh packages/shared-types/scripts/sync-role-hrefs.sh
set -e
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT/frontend"
TMP=".sync-role-hrefs.tmp.ts"
cat > "$TMP" <<'TS'
import { getRoleHrefs } from './src/config/moduleCatalog'
const roles = ['teacher', 'staff', 'librarian', 'admin', 'student', 'parent'] as const
console.log(JSON.stringify(Object.fromEntries(roles.map((r) => [r, getRoleHrefs(r as any)])), null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/default-role-hrefs.json"
cat > "$TMP" <<'TS'
import { getModuleCatalog } from './src/config/moduleCatalog'
console.log(JSON.stringify(getModuleCatalog(), null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/module-catalog.json"
cat > "$TMP" <<'TS'
import { getSidebarConfig, type SidebarMenuItem } from './src/config/sidebar'
import { PLUGIN_REGISTRY } from './src/config/plugins'
// Admin sidebar as the web builds it before per-school filtering: static items keep their
// pluginRequired; each plugin's injected admin pages are appended to their parent tagged with it.
const item = (i: SidebarMenuItem, plugin?: string) => ({
  title: i.title,
  href: i.href,
  ...(i.isLabel ? { label: true } : {}),
  ...(i.pluginRequired || plugin ? { plugin: i.pluginRequired || plugin } : {}),
})
const groups = getSidebarConfig('admin').map((g) => ({ ...item(g), items: (g.subItems ?? []).map((s) => item(s)) }))
for (const p of PLUGIN_REGISTRY) {
  for (const inj of p.sidebarInjections) {
    const roles = inj.roles && inj.roles.length > 0 ? inj.roles : ['admin']
    if (!roles.includes('admin')) continue
    const parent = groups.find((g) => g.title.toLowerCase() === inj.parentTitle.toLowerCase() && g.items.length > 0)
    if (!parent) continue
    for (const ni of inj.items) if (!parent.items.some((x) => x.href === ni.href)) parent.items.push(item(ni, p.id))
  }
}
console.log(JSON.stringify(groups, null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/admin-menu.json"
cat > "$TMP" <<'TS'
import { getSidebarConfig, type SidebarMenuItem } from './src/config/sidebar'
import { PLUGIN_REGISTRY } from './src/config/plugins'
// Student, parent, teacher and librarian sidebars, built like admin-menu.json above.
const item = (i: SidebarMenuItem, plugin?: string) => ({
  title: i.title,
  href: i.href,
  ...(i.isLabel ? { label: true } : {}),
  ...(i.pluginRequired || plugin ? { plugin: i.pluginRequired || plugin } : {}),
})
const out: Record<string, unknown> = {}
for (const role of ['student', 'parent', 'teacher', 'librarian']) {
  const groups = getSidebarConfig(role as any).map((g) => ({ ...item(g), items: (g.subItems ?? []).map((s) => item(s)) }))
  for (const p of PLUGIN_REGISTRY) {
    for (const inj of p.sidebarInjections) {
      const roles = inj.roles && inj.roles.length > 0 ? inj.roles : ['admin']
      if (!roles.includes(role)) continue
      const parent = groups.find((g) => g.title.toLowerCase() === inj.parentTitle.toLowerCase() && g.items.length > 0)
      if (!parent) continue
      for (const ni of inj.items) if (!parent.items.some((x) => x.href === ni.href)) parent.items.push(item(ni, p.id))
    }
  }
  out[role] = groups
}
console.log(JSON.stringify(out, null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/role-menus.json"
cat > "$TMP" <<'TS'
import { getSidebarConfig } from './src/config/sidebar'
import { applyPluginInjections } from './src/config/pluginInjection'
// Same as getModuleGroups() in src/app/admin/settings/user-profiles/page.tsx (all plugins active).
const roles = ['admin', 'staff', 'teacher', 'librarian', 'student', 'parent'] as const
const out: Record<string, { title: string; href: string; items: { title: string; href: string }[] }[]> = {}
for (const role of roles) {
  const config = applyPluginInjections(getSidebarConfig(role as any), role === 'staff' ? 'admin' : role, () => true)
  const groups: { title: string; href: string; items: { title: string; href: string }[] }[] = []
  for (const item of config) {
    if (item.isLabel || item.href === '#') continue
    if (item.subItems && item.subItems.length > 0) {
      const leaf = item.subItems.filter((s) => !s.isLabel && s.href !== '#').map((s) => ({ title: s.title, href: s.href }))
      if (leaf.length > 0) groups.push({ title: item.title, href: item.href, items: leaf })
    } else {
      const root = groups.find((g) => g.title === '__root__')
      if (root) root.items.push({ title: item.title, href: item.href })
      else groups.push({ title: '__root__', href: '#', items: [{ title: item.title, href: item.href }] })
    }
  }
  out[role] = groups
}
console.log(JSON.stringify(out, null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/profile-modules.json"
cat > "$TMP" <<'TS'
import { getSidebarConfig } from './src/config/sidebar'
// Top-level sidebar section titles per role, in default order (Custom Menu: /admin/settings/custom-menu).
const roles = ['admin', 'teacher', 'student', 'parent', 'librarian'] as const
console.log(JSON.stringify(Object.fromEntries(roles.map((r) => [r, getSidebarConfig(r as any).map((i) => i.title)])), null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/sidebar-sections.json"
cat > "$TMP" <<'TS'
import { getSetupSteps } from './src/config/setup-steps'
// Dashboard Setup Assistant steps per role (src/config/setup-steps.ts); the icon goes by name.
const roles = ['admin', 'teacher', 'student', 'parent', 'librarian'] as const
const out = Object.fromEntries(
  roles.map((r) => [r, getSetupSteps(r).map((c) => ({ title: c.title, icon: (c.icon as { displayName?: string }).displayName ?? '', steps: c.steps }))]),
)
console.log(JSON.stringify(out, null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/setup-steps.json"
rm -f "$TMP"
cat > "$TMP" <<'TS'
import { getTourSteps } from './src/config/tour-steps'
// Tour Assistant steps per role (src/config/tour-steps.ts); the category icon goes by name.
const roles = ['admin', 'teacher', 'student', 'parent', 'librarian'] as const
const out = Object.fromEntries(
  roles.map((r) => [r, getTourSteps(r).map((s) => ({ id: s.id, title: s.title, href: s.href, description: s.description, category: s.category, icon: (s.categoryIcon as { displayName?: string }).displayName ?? '' }))]),
)
console.log(JSON.stringify(out, null, 2))
TS
npx --yes tsx "$TMP" > "$ROOT/packages/shared-types/src/tour-steps.json"
rm -f "$TMP"
echo "wrote packages/shared-types/src/default-role-hrefs.json, module-catalog.json, admin-menu.json, profile-modules.json, sidebar-sections.json, setup-steps.json and tour-steps.json"
