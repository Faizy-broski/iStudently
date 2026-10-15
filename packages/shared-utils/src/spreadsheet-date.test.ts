import { describe, expect, it } from 'vitest'

import { normalizeSpreadsheetDate } from './spreadsheet-date'

describe('normalizeSpreadsheetDate', () => {
  it('reads ISO text, Excel serials, Date cells and D/M/Y text', () => {
    expect(normalizeSpreadsheetDate('2014-05-14')).toBe('2014-05-14')
    expect(normalizeSpreadsheetDate('2014-05-14T00:00:00Z')).toBe('2014-05-14')
    expect(normalizeSpreadsheetDate(43719)).toBe('2019-09-11')
    expect(normalizeSpreadsheetDate(new Date(Date.UTC(2010, 0, 5)))).toBe('2010-01-05')
    expect(normalizeSpreadsheetDate('25/12/2012')).toBe('2012-12-25')
  })
  it('returns undefined for blanks and nonsense', () => {
    expect(normalizeSpreadsheetDate('')).toBeUndefined()
    expect(normalizeSpreadsheetDate(null)).toBeUndefined()
    expect(normalizeSpreadsheetDate('not a date')).toBeUndefined()
    expect(normalizeSpreadsheetDate('31/31/2012')).toBeUndefined()
  })
})
