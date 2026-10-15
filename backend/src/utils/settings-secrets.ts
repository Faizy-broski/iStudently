/**
 * school_settings columns that hold credentials. GET /school-settings is open to every signed-in
 * role (the web reads plugins, menu order and module access from it), so these never go out there;
 * admins read them masked from /school-settings/smtp and /school-settings/social-login.
 */
const SECRET_COLUMNS = ['smtp_pass', 'social_login_config', 'vlaby_config'] as const

export function withoutSettingsSecrets<T extends Record<string, unknown>>(row: T): Omit<T, (typeof SECRET_COLUMNS)[number]> {
  const out: Record<string, unknown> = { ...row }
  for (const k of SECRET_COLUMNS) delete out[k]
  return out as Omit<T, (typeof SECRET_COLUMNS)[number]>
}
