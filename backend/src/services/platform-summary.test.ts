import { buildPlatformSummary } from './platform-summary'

const now = new Date('2026-10-15T12:00:00Z')

const schools = [
  { id: 'a', name: 'Old', status: 'active', created_at: '2025-01-10T00:00:00Z' },
  { id: 'b', name: 'Last month', status: 'active', created_at: '2026-09-20T00:00:00Z' },
  { id: 'c', name: 'This month', status: 'suspended', created_at: '2026-10-02T00:00:00Z' },
  { id: 'd', name: 'Trial soon', status: 'active', is_trial: true, trial_ends_at: '2026-10-18T00:00:00Z', created_at: '2026-10-05T00:00:00Z' },
  { id: 'e', name: 'Trial later', status: 'active', is_trial: true, trial_ends_at: '2026-10-27T00:00:00Z', created_at: '2026-08-01T00:00:00Z' },
  { id: 'f', name: 'Trial over', status: 'active', is_trial: true, trial_ends_at: '2026-10-01T00:00:00Z', created_at: '2026-07-01T00:00:00Z' },
]

const records = [
  { amount: 100, currency: 'lyd', payment_status: 'paid', payment_date: '2026-10-03' },
  { amount: '50', currency: 'LYD', payment_status: 'paid', payment_date: '2026-09-28' },
  { amount: 200, currency: 'USD', payment_status: 'paid', payment_date: '2026-10-10' },
  { amount: 30, currency: 'LYD', payment_status: 'overdue', due_date: '2026-10-01' },
  { amount: 70, currency: 'LYD', payment_status: 'unpaid', due_date: '2026-11-01' },
  { amount: 10, currency: null, payment_status: 'pending', due_date: '2027-03-01' },
]

describe('buildPlatformSummary', () => {
  const s = buildPlatformSummary(schools, records, now)

  it('counts schools, trials and real month-over-month growth', () => {
    expect(s.schools).toEqual({
      total: 6,
      active: 5,
      suspended: 1,
      on_trial: 2,
      trials_ending_7d: 1,
      new_this_month: 2,
      new_last_month: 1,
    })
  })

  it('keeps revenue per currency (never sums LYD and USD together)', () => {
    const lyd = s.revenue.find((r) => r.currency === 'LYD')!
    const usd = s.revenue.find((r) => r.currency === 'USD')!
    expect(lyd).toEqual({ currency: 'LYD', paid_this_month: 100, paid_last_month: 50, change_pct: 100, paid_total: 150, outstanding: 100 })
    expect(usd).toMatchObject({ paid_this_month: 200, paid_last_month: 0, change_pct: null, paid_total: 200 })
    expect(s.revenue.find((r) => r.currency === 'USD' && r.outstanding === 10)).toBeTruthy() // null currency -> USD
  })

  it('counts invoices by status and those due soon', () => {
    expect(s.invoices).toEqual({ total: 6, paid: 3, unpaid: 1, pending: 1, overdue: 1, due_next_30d: 1 })
  })

  it('lists trials ending within 14 days, soonest first, and the 5 newest schools', () => {
    expect(s.trials_ending.map((t) => t.id)).toEqual(['d', 'e'])
    expect(s.recent_schools.map((r) => r.id)).toEqual(['d', 'c', 'b', 'e', 'f'])
  })

  it('counts past-due unpaid/pending invoices as overdue', () => {
    const r = buildPlatformSummary([], [
      { amount: 10, currency: 'USD', payment_status: 'unpaid', due_date: '2026-09-20' },
      { amount: 10, currency: 'USD', payment_status: 'pending', due_date: '2026-09-29' },
      { amount: 10, currency: 'USD', payment_status: 'unpaid', due_date: '2026-11-20' },
    ], now)
    expect(r.invoices).toMatchObject({ overdue: 2, unpaid: 1, pending: 0 })
  })

  it('handles an empty platform', () => {
    const e = buildPlatformSummary([], [], now)
    expect(e.schools.total).toBe(0)
    expect(e.revenue).toEqual([])
  })
})
