import { describe, expect, it } from 'vitest'
import { qs } from './query'

describe('qs', () => {
  it('empty when nothing is set', () => expect(qs({ a: undefined, b: '', c: null })).toBe(''))
  it('encodes values and keeps 0/false', () =>
    expect(qs({ q: 'a b&c', n: 0, f: false })).toBe('?q=a%20b%26c&n=0&f=false'))
  it('repeats array keys', () => expect(qs({ id: ['1', '2'], x: 'y' })).toBe('?id=1&id=2&x=y'))
})
