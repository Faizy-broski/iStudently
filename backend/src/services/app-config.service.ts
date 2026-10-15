// Mobile app configuration served before sign-in (GET /api/public/app-config):
// minimum/latest app versions, maintenance mode and feature flags.
//
// Read from environment variables so it can be changed per deploy without a
// database table. Values (all optional):
//   MOBILE_MIN_VERSION_IOS / MOBILE_MIN_VERSION_ANDROID        e.g. 1.0.0  (older builds must update)
//   MOBILE_LATEST_VERSION_IOS / MOBILE_LATEST_VERSION_ANDROID  e.g. 1.2.0  (older builds may update)
//   MOBILE_STORE_URL_IOS / MOBILE_STORE_URL_ANDROID
//   MOBILE_MAINTENANCE=true
//   MOBILE_MAINTENANCE_MESSAGE_EN / MOBILE_MAINTENANCE_MESSAGE_AR
//   MOBILE_FLAGS={"social_wall":false,"miqat_scanner":true}   (JSON object of booleans)
//   MOBILE_PRIVACY_URL / MOBILE_TERMS_URL / MOBILE_ACCOUNT_DELETION_URL   (https only; store listings need them)
//   MOBILE_SUPPORT_EMAIL

export interface PlatformConfig {
  min_version: string | null
  latest_version: string | null
  store_url: string | null
}

export interface AppConfig {
  ios: PlatformConfig
  android: PlatformConfig
  maintenance: { enabled: boolean; message: { en: string | null; ar: string | null } }
  flags: Record<string, boolean>
  /** Shown in the app's settings (privacy policy, terms, account deletion request, support). */
  links: { privacy_url: string | null; terms_url: string | null; account_deletion_url: string | null; support_email: string | null }
  /** Lets clients detect clock skew (Miqat device signatures allow +-60 s). */
  server_time: string
}

const VERSION_RE = /^\d+(\.\d+){0,2}$/

function version(value: string | undefined): string | null {
  const v = value?.trim()
  return v && VERSION_RE.test(v) ? v : null
}

function text(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

function httpsUrl(value: string | undefined): string | null {
  const v = value?.trim()
  return v && /^https:\/\/[^\s]+$/i.test(v) ? v : null
}

function email(value: string | undefined): string | null {
  const v = value?.trim()
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

function parseFlags(raw: string | undefined): Record<string, boolean> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => typeof v === 'boolean') as [string, boolean][],
    )
  } catch {
    console.warn('[app-config] MOBILE_FLAGS is not valid JSON; ignoring')
    return {}
  }
}

export function readAppConfig(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): AppConfig {
  return {
    ios: {
      min_version: version(env.MOBILE_MIN_VERSION_IOS),
      latest_version: version(env.MOBILE_LATEST_VERSION_IOS),
      store_url: text(env.MOBILE_STORE_URL_IOS),
    },
    android: {
      min_version: version(env.MOBILE_MIN_VERSION_ANDROID),
      latest_version: version(env.MOBILE_LATEST_VERSION_ANDROID),
      store_url: text(env.MOBILE_STORE_URL_ANDROID),
    },
    maintenance: {
      enabled: env.MOBILE_MAINTENANCE?.trim().toLowerCase() === 'true',
      message: { en: text(env.MOBILE_MAINTENANCE_MESSAGE_EN), ar: text(env.MOBILE_MAINTENANCE_MESSAGE_AR) },
    },
    flags: parseFlags(env.MOBILE_FLAGS),
    links: {
      privacy_url: httpsUrl(env.MOBILE_PRIVACY_URL),
      terms_url: httpsUrl(env.MOBILE_TERMS_URL),
      account_deletion_url: httpsUrl(env.MOBILE_ACCOUNT_DELETION_URL),
      support_email: email(env.MOBILE_SUPPORT_EMAIL),
    },
    server_time: now.toISOString(),
  }
}
