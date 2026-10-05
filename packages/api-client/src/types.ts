export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  code?: ApiErrorCode | string
  /** True when the server said the failure is transient (503 from the auth middleware). */
  retryable?: boolean
  status?: number
}

/** Special codes the backend returns (see backend/src/middlewares/auth.middleware.ts). */
export type ApiErrorCode =
  | 'TWO_FA_REQUIRED'
  | 'TWO_FA_SETUP_REQUIRED'
  | 'SCHOOL_SUSPENDED'
  | 'TRIAL_EXPIRED'
  | 'AGREEMENT_REJECTED'
  | 'SESSION_EXPIRED'
  | 'AUTH_REQUIRED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'

/** Account-level states the app shell must react to (show a full-screen gate). */
export type AccountGate =
  | 'TWO_FA_REQUIRED'
  | 'TWO_FA_SETUP_REQUIRED'
  | 'SCHOOL_SUSPENDED'
  | 'TRIAL_EXPIRED'
  | 'AGREEMENT_REJECTED'

/**
 * Platform hooks injected by the web or mobile app. Replaces the web's coupling to
 * AuthContext.handleSessionExpiry, window.dispatchEvent('studently:two_fa_*') and sessionStorage.
 */
export interface ApiClientAdapter {
  baseUrl: string
  /** Current access token, or null when signed out. Should wait for any in-flight refresh. */
  getToken(): Promise<string | null>
  /** Called once per 401. */
  onUnauthorized?(): void | Promise<void>
  /** Called when the server blocks the account (2FA, suspended, trial, agreement). */
  onAccountGate?(gate: AccountGate, message?: string): void
  /** Extra headers per request (web: X-School-Id impersonation; mobile: app version, locale). */
  getHeaders?(): Record<string, string> | Promise<Record<string, string>>
  /** Defaults to globalThis.fetch. */
  fetch?: typeof fetch
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Plain objects are JSON-encoded; FormData is sent as multipart. */
  body?: unknown
  /** Milliseconds; default 30000 (backend global timeout). */
  timeout?: number
  /** Skip the bearer token (public endpoints). */
  public?: boolean
}
