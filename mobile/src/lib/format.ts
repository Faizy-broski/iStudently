import { formatDatePattern } from '@studently/shared-utils'

import i18n from '@/i18n'

const nf = () => new Intl.NumberFormat(i18n.language === 'ar' ? 'ar' : 'en', { maximumFractionDigits: 2 })

/** "1,250.50 LYD" — code after the number; Hermes' currency data is limited, so no currency style. */
export function formatMoney(amount: number, currency: string) {
  return `${nf().format(amount)} ${currency}`
}

export function formatNumber(n: number) {
  return nf().format(n)
}

/** Whole days from now until `iso` (0 = today, negative = past). */
export function daysUntil(iso: string, now = new Date()) {
  const start = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const d = new Date(iso)
  const end = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((end - start) / 86_400_000)
}

// Optional date pattern (super admin "Preferred date format"). Patterns with month names are
// English-only (like the web), so in Arabic only numeric patterns apply.
let datePattern: string | null = null
export function setDatePattern(pattern: string | null) {
  datePattern = pattern
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (datePattern && (i18n.language !== 'ar' || !datePattern.includes('MMM'))) return formatDatePattern(d, datePattern)
  return d.toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(i18n.language === 'ar' ? 'ar' : 'en', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Whole years since a date of birth, or undefined. */
export function ageFrom(iso?: string | null) {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const now = new Date()
  let years = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) years--
  return years >= 0 ? years : undefined
}

/** "in 3 days" / "2 hours ago" (web: date-fns formatDistance with suffix). */
export function formatRelative(iso: string, now = Date.now()) {
  const ms = new Date(iso).getTime() - now
  const rtf = new Intl.RelativeTimeFormat(i18n.language === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
  const mins = Math.round(ms / 60000)
  if (Math.abs(mins) < 60) return rtf.format(mins, 'minute')
  const hours = Math.round(mins / 60)
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return rtf.format(days, 'day')
  const months = Math.round(days / 30)
  if (Math.abs(months) < 12) return rtf.format(months, 'month')
  return rtf.format(Math.round(days / 365), 'year')
}
