import { describe, expect, it } from 'vitest'

import { CURRENCY_OPTIONS, DATE_FORMAT_OPTIONS, formatDatePattern } from './settings-options'

describe('formatDatePattern', () => {
  const d = new Date(2026, 7, 6)
  it('matches the web examples', () => {
    expect(formatDatePattern(d, 'MMMM d yyyy')).toBe('August 6 2026')
    expect(formatDatePattern(d, 'MMM d yy')).toBe('Aug 6 26')
    expect(formatDatePattern(d, 'dd/MM/yyyy')).toBe('06/08/2026')
    expect(formatDatePattern(d, 'yyyy-MM-dd')).toBe('2026-08-06')
  })
  it('covers every option', () => {
    for (const p of DATE_FORMAT_OPTIONS) expect(formatDatePattern(d, p)).not.toMatch(/[Mdy]{2}/)
  })
})

describe('CURRENCY_OPTIONS', () => {
  it('has unique ISO codes', () => {
    const codes = CURRENCY_OPTIONS.map((c) => c.value)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain('LYD')
  })
})
