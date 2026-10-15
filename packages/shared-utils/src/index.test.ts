import { describe, expect, it } from 'vitest'
import { compareVersions, isRtl, isUpdateRequired } from './index'

describe('compareVersions', () => {
  it.each([
    ['1.0.0', '1.0.0', 0],
    ['1.10.0', '1.9.2', 1],
    ['1.2', '1.2.0', 0],
    ['1.2.1', '1.2', 1],
    ['0.9.9', '1.0.0', -1],
    ['2', '10', -1],
  ] as const)('%s vs %s -> %s', (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected)
  })
})

describe('isUpdateRequired', () => {
  it('no minimum means no update', () => expect(isUpdateRequired('1.0.0', null)).toBe(false))
  it('older than minimum', () => expect(isUpdateRequired('1.0.0', '1.0.1')).toBe(true))
  it('equal or newer is fine', () => {
    expect(isUpdateRequired('1.0.1', '1.0.1')).toBe(false)
    expect(isUpdateRequired('1.1.0', '1.0.9')).toBe(false)
  })
})

describe('isRtl', () => {
  it('Arabic is RTL', () => {
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('ar-LY')).toBe(true)
    expect(isRtl('en')).toBe(false)
  })
})
