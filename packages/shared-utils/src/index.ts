export type Locale = 'en' | 'ar'

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar']

export function isRtl(locale: string): boolean {
  return locale.startsWith('ar')
}

/** Compares dotted versions numerically ("1.10.0" > "1.9.2"). Missing parts count as 0. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/** True when `current` is older than `minimum` (null minimum = no requirement). */
export function isUpdateRequired(current: string, minimum: string | null): boolean {
  return !!minimum && compareVersions(current, minimum) < 0
}
/** Synthetic sign-in emails for users without one (backend/src/utils/email.util.ts); never mailed. */
export const PLACEHOLDER_EMAIL_DOMAIN = 'temp.local'

export function isPlaceholderEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`)
}

export * from './csv'
export * from './csv-parse'
export * from './html-text'
export * from './settings-options'
export * from './print-layout'
export * from './validation'
export * from './physics-labs-catalog'
export * from './spreadsheet-date'
