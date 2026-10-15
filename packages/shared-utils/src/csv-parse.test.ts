import { describe, expect, it } from 'vitest'

import { csvToObjects, parseCsv } from './csv-parse'
import { toCsv } from './csv'

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, newlines in quotes, CRLF and a BOM', () => {
    const text = '﻿name,note\r\n"Al Noor, Tripoli","say ""hi""\nok"\r\nمدرسة,\r\n'
    expect(parseCsv(text)).toEqual([['name', 'note'], ['Al Noor, Tripoli', 'say "hi"\nok'], ['مدرسة', '']])
  })
  it('reads what toCsv writes', () => {
    const csv = toCsv(['a', 'b'], [['x,1', 'y"2']])
    expect(parseCsv(csv)).toEqual([['a', 'b'], ['x,1', 'y"2']])
  })
  it('detects semicolon separated files and skips blank lines', () => {
    expect(parseCsv('a;b\n1;2\n\n')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('csvToObjects keys by lower-cased header', () => {
    expect(csvToObjects('First_Name,Email\nAli, a@b.c ').rows).toEqual([{ first_name: 'Ali', email: 'a@b.c' }])
  })
})
