// Helpers for making email optional for records (e.g. students) while still
// satisfying Supabase Auth, which requires every auth.users row to have an
// email — and this app's login flow (including username login) always
// resolves to supabase.auth.signInWithPassword({ email, password }).
//
// When no real email is supplied we generate a synthetic placeholder and
// store it in both auth.users.email and profiles.email. Placeholder emails
// must NEVER be shown to the frontend (redact to null in API responses) and
// NEVER used as a real contact address (e.g. for sending mail).

export const PLACEHOLDER_EMAIL_DOMAIN = 'temp.local'

function slugify(value?: string): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * Generates a synthetic placeholder email for records that don't provide a
 * real one, in the form "first.last.xxxx@temp.local". Falls back to "user"
 * for any name part that's missing/empty after slugifying.
 */
export function generatePlaceholderEmail(firstName?: string, lastName?: string): string {
  const first = slugify(firstName) || 'user'
  const last = slugify(lastName) || 'user'
  const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, '0')
  return `${first}.${last}.${suffix}@${PLACEHOLDER_EMAIL_DOMAIN}`
}

/**
 * True if the given email is one of our synthetic placeholders (i.e. not a
 * real, contactable address).
 */
export function isPlaceholderEmail(email?: string | null): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}

/**
 * True if the given email is present and is NOT a synthetic placeholder.
 */
export function hasRealEmail(email?: string | null): boolean {
  return !!email && !isPlaceholderEmail(email)
}

/**
 * Returns the email as-is if it's real, or null if it's missing/placeholder.
 * Use this to keep placeholder emails out of API responses.
 */
export function redactPlaceholderEmail(email?: string | null): string | null {
  return hasRealEmail(email) ? (email as string) : null
}

/**
 * Shallow helper that redacts `.email` on an object, returning a new object
 * with the same shape but a redacted email field.
 */
export function withRedactedEmail<T extends { email?: string | null }>(record: T): T {
  if (!record) return record
  return { ...record, email: redactPlaceholderEmail(record.email) }
}
