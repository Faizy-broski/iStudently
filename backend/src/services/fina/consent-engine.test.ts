/**
 * ★ Written before any Al-Fina' feature code, per the spec's explicit
 * instruction (§24): "Missing consent record -> default 1, never 3."
 *
 * Unit-level (mocked Supabase client), not a live-DB integration test —
 * this codebase has no seeded test-database/environment convention yet
 * (jest is configured but no project test file existed before this one).
 * A true end-to-end DB integration test belongs alongside a dedicated test
 * Supabase project once that infrastructure exists; until then, these tests
 * pin the exact contract activeLevel() must never violate.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))

import { supabase } from '../../config/supabase'
import { activeLevel, ConsentLevel } from './consent-engine.service'

function mockConsentsQuery(rows: any[] | null, error: any = null) {
  const builder: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
  }
  builder.then = (resolve: any) => resolve({ data: rows, error })
  ;(supabase.from as unknown as jest.Mock).mockReturnValue(builder)
  return builder
}

describe('consent-engine.service — activeLevel (★ missing-consent-defaults-to-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('★ returns INNER_CIRCLE, never SCHOOL_SCOPE, when no consent record exists for the student', async () => {
    mockConsentsQuery([])
    const level = await activeLevel('11111111-1111-1111-1111-111111111101')
    expect(level).toBe(ConsentLevel.INNER_CIRCLE)
    expect(level).not.toBe(ConsentLevel.SCHOOL_SCOPE)
  })

  it('★ returns INNER_CIRCLE, never throws, when the consent query itself errors', async () => {
    mockConsentsQuery(null, { message: 'connection reset' })
    await expect(activeLevel('11111111-1111-1111-1111-111111111102')).resolves.toBe(ConsentLevel.INNER_CIRCLE)
  })

  it('returns the MOST RESTRICTIVE level when multiple active consent-guardian rows disagree (joint guardianship tie-break)', async () => {
    mockConsentsQuery([
      { level: ConsentLevel.SCHOOL_SCOPE, valid_until: null },
      { level: ConsentLevel.DENY_ALL, valid_until: null },
    ])
    const level = await activeLevel('11111111-1111-1111-1111-111111111103')
    expect(level).toBe(ConsentLevel.DENY_ALL)
  })

  it('ignores an expired SPECIAL_GRANT row and falls back to the safe default', async () => {
    mockConsentsQuery([{ level: ConsentLevel.SPECIAL_GRANT, valid_until: '2000-01-01T00:00:00.000Z' }])
    const level = await activeLevel('11111111-1111-1111-1111-111111111104')
    expect(level).toBe(ConsentLevel.INNER_CIRCLE)
  })
})
