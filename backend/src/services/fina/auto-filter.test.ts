/**
 * Contributes to AT-07 ("body containing a phone number or commercial offer
 * -> blocked") and the "no free/other post type" rule's content-side
 * counterpart — the consent hard-stop itself is covered by
 * consent-gate.test.ts.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./consent-gate.service', () => ({ assertPublishable: jest.fn().mockResolvedValue(undefined) }))

import { supabase } from '../../config/supabase'
import { runAutoFilter } from './auto-filter.service'

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'in']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.then = (resolve: any) => resolve(result)
  return builder
}

function mockRules(rules: any[]) {
  ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
    if (table === 'fina_filter_rules') return makeQueryBuilder({ data: rules, error: null })
    return makeQueryBuilder({ data: [], error: null })
  })
}

describe('auto-filter.service — runAutoFilter', () => {
  beforeEach(() => jest.clearAllMocks())

  it('★ AT-07: blocks a post body containing a Libyan phone number', async () => {
    mockRules([{ kind: 'phone_regex', pattern: '(\\+?218|0)\\s*9[0-9]([\\-\\s]?[0-9]){7}', is_active: true }])
    const result = await runAutoFilter({ id: 'p1', title: null, body: 'Call me at 0912345678 please' })
    expect(result.passed).toBe(false)
  })

  it('★ AT-07: blocks a post body containing commercial language and tags it', async () => {
    mockRules([{ kind: 'commercial_keyword', pattern: 'discount', action: 'block_and_tag_commercial', is_active: true }])
    const result = await runAutoFilter({ id: 'p2', title: 'Big sale', body: 'Huge discount this week!' })
    expect(result.passed).toBe(false)
    expect(result.commercialSuspected).toBe(true)
  })

  it('blocks a post referencing student grades or ranking', async () => {
    mockRules([{ kind: 'grade_reference', pattern: 'gpa', is_active: true }])
    const result = await runAutoFilter({ id: 'p3', title: null, body: 'Congratulations on your GPA improvement!' })
    expect(result.passed).toBe(false)
  })

  it('blocks a link to a domain outside the whitelist (empty whitelist = fail closed)', async () => {
    mockRules([])
    const result = await runAutoFilter({ id: 'p4', title: null, body: 'Check this out: https://random-external-site.com/page' })
    expect(result.passed).toBe(false)
  })

  it('passes clean, on-topic educational content', async () => {
    mockRules([{ kind: 'commercial_keyword', pattern: 'discount', is_active: true }])
    const result = await runAutoFilter({ id: 'p5', title: 'Trip', body: 'We visited the science museum today.' })
    expect(result.passed).toBe(true)
  })

  it('never names a student in the block reason (delegates the exact copy to the consent gate)', async () => {
    const gate = jest.requireMock('./consent-gate.service')
    gate.assertPublishable.mockRejectedValueOnce(
      new Error('This content cannot be published: it includes a student outside the permitted scope. Please contact administration.')
    )
    const result = await runAutoFilter({ id: 'p6', title: null, body: 'A normal caption' })
    expect(result.passed).toBe(false)
    expect(result.reason).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+/) // no "Firstname Lastname"-shaped text
    expect(result.reason).toContain('outside the permitted scope')
  })
})
