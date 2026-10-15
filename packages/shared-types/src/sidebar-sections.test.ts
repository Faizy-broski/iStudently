import { describe, expect, it } from 'vitest'

import { resolveMenuOrder, SIDEBAR_SECTIONS } from './sidebar-sections'

describe('resolveMenuOrder', () => {
  it('uses the default order when nothing is saved', () => {
    expect(resolveMenuOrder('teacher', null)).toEqual(SIDEBAR_SECTIONS.teacher)
  })
  it('keeps the saved order, drops unknown sections and appends new ones', () => {
    const [a, b, ...rest] = SIDEBAR_SECTIONS.parent
    expect(resolveMenuOrder('parent', [b, 'gone', a])).toEqual([b, a, ...rest])
  })
})
