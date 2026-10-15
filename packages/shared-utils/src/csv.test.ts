import { describe, expect, it } from 'vitest'

import { toCsv } from './csv'

describe('toCsv', () => {
  it('adds a BOM and quotes commas, quotes and newlines', () => {
    const csv = toCsv(['Name', 'Note'], [['Al Noor, Tripoli', 'say "hi"\nok'], ['مدرسة', null]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual(['Name,Note', '"Al Noor, Tripoli","say ""hi""\nok"', 'مدرسة,'])
  })

  it('neutralises formula cells but keeps negative numbers', () => {
    expect(toCsv(['a', 'b'], [['=HYPERLINK("x")', -5]]).slice(1).split('\r\n')[1]).toBe(`"'=HYPERLINK(""x"")",-5`)
  })
})
