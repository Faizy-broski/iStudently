import type { AccountGate, ApiClientAdapter, ApiResponse, RequestOptions } from './types'

const ACCOUNT_GATES: readonly AccountGate[] = [
  'TWO_FA_REQUIRED',
  'TWO_FA_SETUP_REQUIRED',
  'SCHOOL_SUSPENDED',
  'TRIAL_EXPIRED',
  'AGREEMENT_REJECTED',
]

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

async function readJson(response: Response): Promise<Record<string, any>> {
  if (response.status === 204) return {}
  const text = await response.text().catch(() => '')
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 200) }
  }
}

export function createApiClient(adapter: ApiClientAdapter) {
  const doFetch = adapter.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))

  async function request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { timeout = 30000, public: isPublic, body, headers, signal, ...init } = options

    const token = isPublic ? null : await adapter.getToken()
    if (!isPublic && !token) {
      return { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    const onCallerAbort = () => controller.abort()
    signal?.addEventListener('abort', onCallerAbort)

    try {
      const extra = (await adapter.getHeaders?.()) ?? {}
      const response = await doFetch(`${adapter.baseUrl}${endpoint}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && !isFormData(body) ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extra,
          ...(headers as Record<string, string> | undefined),
        },
        body: body === undefined ? undefined : isFormData(body) ? body : JSON.stringify(body),
      })

      const data = await readJson(response)

      if (response.status === 401 && !isPublic) {
        await adapter.onUnauthorized?.()
        return { success: false, error: 'Session expired', code: 'SESSION_EXPIRED', status: 401 }
      }

      if (response.status === 403 && ACCOUNT_GATES.includes(data.code)) {
        adapter.onAccountGate?.(data.code, data.error)
        return { success: false, error: data.error, code: data.code, status: 403 }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data.error || data.message || 'Request failed',
          code: data.code,
          retryable: data.retryable === true || response.status === 503,
          status: response.status,
          errorData: data,
        }
      }

      if (response.status === 204) return { success: true, status: 204 }
      // A few older endpoints (e.g. GET /setup/campuses) return a bare array instead of the envelope.
      if (Array.isArray(data)) return { success: true, data: data as T, status: response.status }
      return { ...data, success: data.success ?? true, status: response.status } as ApiResponse<T>
    } catch {
      const timedOut = controller.signal.aborted && !signal?.aborted
      return {
        success: false,
        error: timedOut ? 'Request timed out' : 'Network error',
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        retryable: true,
      }
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onCallerAbort)
    }
  }

  return {
    request,
    get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: 'GET' }),
    post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
      request<T>(endpoint, { ...options, method: 'POST', body }),
    put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
      request<T>(endpoint, { ...options, method: 'PUT', body }),
    patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
      request<T>(endpoint, { ...options, method: 'PATCH', body }),
    del: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, { ...options, method: 'DELETE' }),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
