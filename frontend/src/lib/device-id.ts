/**
 * A stable random id for this browser, sent as `X-Device-Id` on VLaby requests so the server can
 * enforce the per-user device limit. Kept in localStorage; if storage is unavailable (private
 * window, blocked site data) an in-memory id is used for the life of the page.
 */
const KEY = 'studently_device_id'

let memoryId: string | null = null

function generate(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // fall through
  }
  const bytes = new Uint8Array(16)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Server accepts 8-64 chars of [A-Za-z0-9-]. */
function valid(id: string | null): id is string {
  return !!id && /^[A-Za-z0-9-]{8,64}$/.test(id)
}

export function getDeviceId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.localStorage.getItem(KEY)
    if (valid(stored)) return stored
    const fresh = generate()
    window.localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    if (!memoryId) memoryId = generate()
    return memoryId
  }
}
