// Super-admin dashboard summary, computed server-side in one call (GET /api/dashboard/summary).
// Replaces the web's 6 calls and its made-up trend percentages (superadmin/dashboard/page.tsx:115-120):
// trends here are real month-over-month numbers, and revenue is kept per currency (the old stats
// summed amounts across currencies).

export interface SummarySchoolRow {
  id: string
  name: string
  status: string | null
  is_trial?: boolean | null
  trial_ends_at?: string | null
  created_at: string
  logo_url?: string | null
}

export interface SummaryRecordRow {
  amount: number | string | null
  currency?: string | null
  payment_status: string
  payment_date?: string | null
  due_date?: string | null
}

export interface CurrencyRevenue {
  currency: string
  paid_this_month: number
  paid_last_month: number
  /** Percent change vs last month; null when last month was 0. */
  change_pct: number | null
  paid_total: number
  outstanding: number
}

export interface PlatformSummary {
  schools: {
    total: number
    active: number
    suspended: number
    on_trial: number
    trials_ending_7d: number
    new_this_month: number
    new_last_month: number
  }
  invoices: { total: number; paid: number; unpaid: number; pending: number; overdue: number; due_next_30d: number }
  revenue: CurrencyRevenue[]
  trials_ending: Pick<SummarySchoolRow, 'id' | 'name' | 'trial_ends_at' | 'logo_url'>[]
  recent_schools: SummarySchoolRow[]
  generated_at: string
}

const DAY = 86_400_000
const monthKey = (d: Date) => d.getUTCFullYear() * 12 + d.getUTCMonth()
const round2 = (n: number) => Math.round(n * 100) / 100

export function buildPlatformSummary(schools: SummarySchoolRow[], records: SummaryRecordRow[], now = new Date()): PlatformSummary {
  const thisMonth = monthKey(now)
  const isTrialActive = (s: SummarySchoolRow) => !!s.is_trial && !!s.trial_ends_at && new Date(s.trial_ends_at) >= now
  const endsWithin = (s: SummarySchoolRow, days: number) =>
    isTrialActive(s) && new Date(s.trial_ends_at!).getTime() - now.getTime() <= days * DAY

  const createdIn = (key: number) => schools.filter((s) => monthKey(new Date(s.created_at)) === key).length

  const byCurrency = new Map<string, CurrencyRevenue>()
  const cur = (code: string) => {
    if (!byCurrency.has(code)) {
      byCurrency.set(code, { currency: code, paid_this_month: 0, paid_last_month: 0, change_pct: null, paid_total: 0, outstanding: 0 })
    }
    return byCurrency.get(code)!
  }

  let dueNext30 = 0
  for (const r of records) {
    const amount = Number(r.amount) || 0
    const c = cur((r.currency || 'USD').toUpperCase())
    if (r.payment_status === 'paid') {
      c.paid_total += amount
      if (r.payment_date) {
        const k = monthKey(new Date(r.payment_date))
        if (k === thisMonth) c.paid_this_month += amount
        if (k === thisMonth - 1) c.paid_last_month += amount
      }
    } else {
      c.outstanding += amount
      if (r.due_date) {
        const until = new Date(r.due_date).getTime() - now.getTime()
        if (until >= -DAY && until <= 30 * DAY) dueNext30++
      }
    }
  }
  const revenue = [...byCurrency.values()]
    .map((c) => ({
      ...c,
      paid_this_month: round2(c.paid_this_month),
      paid_last_month: round2(c.paid_last_month),
      paid_total: round2(c.paid_total),
      outstanding: round2(c.outstanding),
      change_pct: c.paid_last_month > 0 ? Math.round(((c.paid_this_month - c.paid_last_month) / c.paid_last_month) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.paid_total - a.paid_total)

  // Unpaid/pending invoices past their due date count as overdue (nothing updates the stored status).
  const today = now.toISOString().slice(0, 10)
  const effective = (r: SummaryRecordRow) =>
    (r.payment_status === 'unpaid' || r.payment_status === 'pending') && r.due_date && r.due_date.slice(0, 10) < today
      ? 'overdue'
      : r.payment_status
  const count = (status: string) => records.filter((r) => effective(r) === status).length

  return {
    schools: {
      total: schools.length,
      active: schools.filter((s) => s.status === 'active').length,
      suspended: schools.filter((s) => s.status === 'suspended').length,
      on_trial: schools.filter(isTrialActive).length,
      trials_ending_7d: schools.filter((s) => endsWithin(s, 7)).length,
      new_this_month: createdIn(thisMonth),
      new_last_month: createdIn(thisMonth - 1),
    },
    invoices: {
      total: records.length,
      paid: count('paid'),
      unpaid: count('unpaid'),
      pending: count('pending'),
      overdue: count('overdue'),
      due_next_30d: dueNext30,
    },
    revenue,
    trials_ending: schools
      .filter((s) => endsWithin(s, 14))
      .sort((a, b) => new Date(a.trial_ends_at!).getTime() - new Date(b.trial_ends_at!).getTime())
      .map(({ id, name, trial_ends_at, logo_url }) => ({ id, name, trial_ends_at, logo_url })),
    recent_schools: [...schools].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
    generated_at: now.toISOString(),
  }
}
