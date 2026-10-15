import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { v } from './validation'

const issues = (schema: z.ZodTypeAny, value: unknown) =>
  schema.safeParse(value).error?.issues.map((i) => i.message) ?? []

describe('shared validation', () => {
  it('required trims and reports an i18n key', () => {
    expect(issues(v.required(), '   ')).toEqual(['app.v_required'])
    expect(issues(v.required(), 'Al Noor')).toEqual([])
  })
  it('slug', () => {
    expect(issues(v.slug(), 'al-noor-2')).toEqual([])
    expect(issues(v.slug(), 'Al Noor')).toContain('app.v_slug')
  })
  it('email', () => expect(issues(v.email(), 'nope')).toEqual(['app.v_email']))
  it('money', () => {
    expect(issues(v.money(), -1)).toEqual(['app.v_min_zero'])
    expect(issues(v.money(), 'x')).toEqual(['app.v_number'])
  })
})

import { dueDateFor, planPrice, vBilling } from './validation'

describe('billing helpers', () => {
  it('due date adds one cycle', () => {
    expect(dueDateFor('2026-10-06', 'Monthly')).toBe('2026-11-06')
    expect(dueDateFor('2026-11-30', 'Quarterly')).toBe('2027-02-28')
    expect(dueDateFor('2028-01-31', 'Monthly')).toBe('2028-02-29')
    expect(dueDateFor('2026-10-06', 'Yearly')).toBe('2027-10-06')
    expect(dueDateFor('bad', 'Monthly')).toBe('bad')
  })
  it('plan price by cycle', () => {
    const p = { monthly_price: 10, quarterly_price: 27, yearly_price: 100 }
    expect([planPrice(p, 'Monthly'), planPrice(p, 'Quarterly'), planPrice(p, 'Yearly')]).toEqual([10, 27, 100])
  })
  it('date and currency rules', () => {
    expect(vBilling.date().safeParse('2026-10-06').success).toBe(true)
    expect(vBilling.date().safeParse('6/10/2026').success).toBe(false)
    expect(vBilling.currency().parse('lyd')).toBe('LYD')
    expect(vBilling.currency().safeParse('dinar').success).toBe(false)
  })
})
