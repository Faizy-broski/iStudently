import type { UserRole } from './index'

/**
 * School plugins that switch app features on/off. Ids match school_settings.active_plugins
 * (returned as `plugins` by GET /auth/me) and frontend/src/config/plugins.ts.
 */
export type PluginId =
  | 'grievance_portal'
  | 'hifzi'
  | 'miqat'
  | 'weather_alerts'
  | 'hadith_forty'
  | 'qirtasi'
  | 'online_classes'

export interface MobileFeature {
  roles: readonly UserRole[]
  /** Hidden unless this plugin is active for the school (web: SidebarMenuItem.pluginRequired). */
  plugin?: PluginId
}

/**
 * App features per role. Plugin gates mirror frontend/src/config/sidebar.ts `pluginRequired`
 * for the same role, so the app hides exactly what the web hides.
 * Features with no plugin are always on for their roles.
 */
export const MOBILE_FEATURES = {
  timetable: { roles: ['student', 'parent', 'teacher'] },
  attendance: { roles: ['student', 'parent', 'teacher'] },
  grades: { roles: ['student', 'parent', 'teacher'] },
  assignments: { roles: ['student', 'parent', 'teacher'] },
  class_diary: { roles: ['student', 'parent', 'teacher'] },
  events: { roles: ['student', 'parent', 'teacher', 'admin'] },
  messages: { roles: ['student', 'parent', 'teacher', 'admin', 'staff', 'librarian'] },
  fees: { roles: ['student', 'parent'] },
  quizzes: { roles: ['student', 'teacher'] },

  complaints: { roles: ['student', 'parent', 'teacher', 'librarian', 'admin'], plugin: 'grievance_portal' },
  quran: { roles: ['student', 'parent', 'teacher', 'admin'], plugin: 'hifzi' },
  hadith_forty: { roles: ['student', 'parent', 'teacher', 'admin'], plugin: 'hadith_forty' },
  online_class: { roles: ['student', 'parent', 'teacher', 'admin'], plugin: 'online_classes' },
  worksheets: { roles: ['student', 'parent', 'teacher', 'librarian'], plugin: 'qirtasi' },
  weather: { roles: ['admin'], plugin: 'weather_alerts' },

  /** QR attendance card and gate history come from Miqat. */
  qr_card: { roles: ['student', 'parent'], plugin: 'miqat' },
  gate_history: { roles: ['parent'], plugin: 'miqat' },
  staff_rotating_code: { roles: ['teacher'], plugin: 'miqat' },
  /** Device mode entered with an admin enrolment code (not a login role). */
  scanner: { roles: ['admin', 'staff', 'teacher'], plugin: 'miqat' },
} as const satisfies Record<string, MobileFeature>

export type MobileFeatureKey = keyof typeof MOBILE_FEATURES

export function isFeatureEnabled(key: MobileFeatureKey, role: UserRole, activePlugins: readonly string[]): boolean {
  const feature: MobileFeature = MOBILE_FEATURES[key]
  if (!feature.roles.includes(role)) return false
  return !feature.plugin || activePlugins.includes(feature.plugin)
}

/** Every feature key enabled for this role and school. */
export function enabledFeatures(role: UserRole, activePlugins: readonly string[]): MobileFeatureKey[] {
  return (Object.keys(MOBILE_FEATURES) as MobileFeatureKey[]).filter((k) => isFeatureEnabled(k, role, activePlugins))
}
