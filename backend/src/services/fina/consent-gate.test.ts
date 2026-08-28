/**
 * ★ Written before any Al-Fina' feature code, per the spec's explicit
 * instruction (§24): cross-school data leakage must be impossible.
 *
 * Unit-level (mocked Supabase client + mocked campus-validation), not a
 * live-DB integration test — see consent-engine.test.ts's header for why.
 * This pins resolveMediaDecision()'s cross-school short-circuit: a caller
 * whose school differs from the media's school, with no confirmed campus
 * relationship, must be denied before any consent-scope logic even runs.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../utils/campus-validation', () => ({ validateCampusAccess: jest.fn() }))

import { supabase } from '../../config/supabase'
import { validateCampusAccess } from '../../utils/campus-validation'
import { resolveMediaDecision } from './consent-gate.service'

const SCHOOL_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SCHOOL_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const MEDIA_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.then = (resolve: any) => resolve(result)
  return builder
}

describe('consent-gate.service — resolveMediaDecision (★ cross-school isolation)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('★ denies a caller from a different school with no confirmed campus relationship, before any consent-scope check runs', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_media') return makeQueryBuilder({ data: { id: MEDIA_ID, school_id: SCHOOL_A }, error: null })
      if (table === 'fina_face_tags') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })
    ;(validateCampusAccess as unknown as jest.Mock).mockResolvedValue(false)

    const decision = await resolveMediaDecision(
      { profileId: 'teacher-in-school-b', role: 'teacher', schoolId: SCHOOL_B },
      MEDIA_ID
    )

    expect(decision).toEqual({ kind: 'denied' })
    // fina_face_tags must never even be consulted once the cross-school
    // check fails — proves the short-circuit, not just the final outcome.
    expect(supabase.from).not.toHaveBeenCalledWith('fina_face_tags')
  })

  it('does not deny a same-school caller with no tagged students (generic photo, SCHOOL_SCOPE default)', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_media') {
        return makeQueryBuilder({ data: { id: MEDIA_ID, school_id: SCHOOL_A, processing_state: 'ready' }, error: null })
      }
      if (table === 'fina_face_tags') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    const decision = await resolveMediaDecision(
      { profileId: 'teacher-in-school-a', role: 'teacher', schoolId: SCHOOL_A },
      MEDIA_ID
    )

    expect(decision).toEqual({ kind: 'full' })
  })

  it('returns denied (never throws, never leaks existence) when the media row cannot be found', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => makeQueryBuilder({ data: null, error: null }))

    const decision = await resolveMediaDecision(
      { profileId: 'someone', role: 'teacher', schoolId: SCHOOL_A },
      'nonexistent-media-id'
    )

    expect(decision).toEqual({ kind: 'denied' })
  })

  it('admin/media_officer get "full" without ever querying fina_face_tags (performance fast-path)', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_media') {
        return makeQueryBuilder({ data: { id: MEDIA_ID, school_id: SCHOOL_A, processing_state: 'pending_tagging' }, error: null })
      }
      return makeQueryBuilder({ data: null, error: null })
    })

    for (const role of ['admin', 'media_officer']) {
      ;(supabase.from as unknown as jest.Mock).mockClear()
      const decision = await resolveMediaDecision({ profileId: 'staff-1', role, schoolId: SCHOOL_A }, MEDIA_ID)
      expect(decision).toEqual({ kind: 'full' })
      expect(supabase.from).not.toHaveBeenCalledWith('fina_face_tags')
    }
  })

  it('★ super_admin is denied outright, without ever querying fina_media — spec §12 gives SYSADMIN zero content access', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => makeQueryBuilder({ data: null, error: null }))

    const decision = await resolveMediaDecision({ profileId: 'vendor-1', role: 'super_admin', schoolId: SCHOOL_A }, MEDIA_ID)

    expect(decision).toEqual({ kind: 'denied' })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
