import type { ApiClient } from '../client'

export interface PlatformConfig {
  min_version: string | null
  latest_version: string | null
  store_url: string | null
}

/** GET /public/app-config (backend/src/services/app-config.service.ts). */
export interface AppConfig {
  ios: PlatformConfig
  android: PlatformConfig
  maintenance: { enabled: boolean; message: { en: string | null; ar: string | null } }
  flags: Record<string, boolean>
  /** Older servers omit this. */
  links?: { privacy_url: string | null; terms_url: string | null; account_deletion_url: string | null; support_email: string | null }
  server_time: string
}

export function appConfigApi(api: ApiClient) {
  return {
    /** Public: called before sign-in. Short timeout so a slow network never blocks launch for long. */
    get: () => api.get<AppConfig>('/public/app-config', { public: true, timeout: 8000 }),
  }
}
