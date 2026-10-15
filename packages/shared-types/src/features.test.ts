import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { enabledFeatures, isFeatureEnabled, MOBILE_FEATURES, type PluginId } from './features'
import type { UserRole } from './index'

// Plugin gates per role, read from the web's sidebar (frontend/src/config/sidebar.ts).
const sidebar = readFileSync(join(__dirname, '../../../frontend/src/config/sidebar.ts'), 'utf8')

function webPluginsFor(sectionConst: string): Set<string> {
  const start = sidebar.indexOf(`const ${sectionConst}`)
  const end = sidebar.indexOf('\nconst ', start + 1)
  const section = sidebar.slice(start, end === -1 ? undefined : end)
  return new Set([...section.matchAll(/pluginRequired:\s*["'](\w+)["']/g)].map((m) => m[1]))
}

const APP_ROLES: [UserRole, string][] = [
  ['student', 'studentMenuItems'],
  ['parent', 'parentMenuItems'],
  ['teacher', 'teacherMenuItems'],
]

describe('plugin gates match the web sidebar', () => {
  it.each(APP_ROLES)('every plugin the web gates for %s has an app feature for that role', (role, sectionConst) => {
    const webPlugins = webPluginsFor(sectionConst)
    expect(webPlugins.size).toBeGreaterThan(0)
    const appPlugins = new Set(
      Object.values(MOBILE_FEATURES)
        .filter((f) => 'plugin' in f && (f.roles as readonly string[]).includes(role))
        .map((f) => (f as { plugin: PluginId }).plugin),
    )
    expect([...webPlugins].filter((p) => !appPlugins.has(p))).toEqual([])
  })
})

describe('isFeatureEnabled', () => {
  it('core features are on for their roles', () => {
    expect(isFeatureEnabled('timetable', 'student', [])).toBe(true)
    expect(isFeatureEnabled('fees', 'teacher', [])).toBe(false)
  })

  it('plugin features need the plugin', () => {
    expect(isFeatureEnabled('complaints', 'parent', [])).toBe(false)
    expect(isFeatureEnabled('complaints', 'parent', ['grievance_portal'])).toBe(true)
    expect(isFeatureEnabled('qr_card', 'student', ['miqat'])).toBe(true)
    expect(isFeatureEnabled('qr_card', 'teacher', ['miqat'])).toBe(false)
  })

  it('super admin gets none of the school features', () => {
    expect(enabledFeatures('super_admin', ['miqat', 'hifzi', 'grievance_portal'])).toEqual([])
  })
})
