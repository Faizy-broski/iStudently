import { z } from 'zod'

// Shared validation building blocks. Messages are i18n keys from the app's `app` namespace
// (mobile/src/i18n/app/*.json); the web can map them to its own strings.
export const v = {
  required: (max = 200) => z.string().trim().min(1, 'app.v_required').max(max, 'app.v_too_long'),
  optional: (max = 500) => z.string().trim().max(max, 'app.v_too_long').optional().or(z.literal('')),
  email: () => z.string().trim().min(1, 'app.v_required').email('app.v_email'),
  slug: () =>
    z
      .string()
      .trim()
      .min(2, 'app.v_too_short')
      .max(63, 'app.v_too_long')
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'app.v_slug'),
  money: () => z.number({ error: 'app.v_number' }).min(0, 'app.v_min_zero'),
  url: () => z.string().trim().url('app.v_url').optional().or(z.literal('')),
}

/** New password + confirmation (backend /auth/change-password requires at least 8 characters). */
export const passwordPair = () =>
  z
    .object({ password: z.string().min(8, 'app.v_min8').max(128, 'app.v_too_long'), confirm: z.string() })
    .refine((f) => f.password === f.confirm, { path: ['confirm'], message: 'app.v_password_match' })

/** Billing helpers shared by the app (and the web once it moves to the billing API). */
export type BillingCycle = 'Monthly' | 'Quarterly' | 'Yearly'

export const vBilling = {
  date: () => z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'app.v_date'),
  currency: () => z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'app.v_currency'),
}

/** Price of a plan for a cycle. */
export function planPrice(plan: { monthly_price: number; quarterly_price: number; yearly_price: number }, cycle: BillingCycle) {
  return cycle === 'Yearly' ? plan.yearly_price : cycle === 'Quarterly' ? plan.quarterly_price : plan.monthly_price
}

/** Due date = start date + one cycle (YYYY-MM-DD, UTC). */
export function dueDateFor(startDate: string, cycle: BillingCycle): string {
  const d = new Date(`${startDate}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return startDate
  const months = cycle === 'Yearly' ? 12 : cycle === 'Quarterly' ? 3 : 1
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  // Clamp to the target month's last day (30 Nov + 3 months = 28 Feb, not 2 Mar).
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

export function todayIso(now = new Date()) {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10)
}
