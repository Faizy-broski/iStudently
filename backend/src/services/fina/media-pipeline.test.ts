/**
 * Covers the mutual-exclusion guard that stands in for the spec's automated
 * "unidentified face -> maximum restriction" rule in this build's
 * manual-tagging design (§9 deviation), and confirms confirmTagging()
 * computes and stores the correct effective scope before handing off to
 * variant generation.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn(), storage: { from: jest.fn() } } }))
jest.mock('../../utils/fina-jobs', () => ({ enqueueFinaJob: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./audit-logger.service', () => ({ logAuditFromCaller: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./consent-engine.service', () => {
  const actual = jest.requireActual('./consent-engine.service')
  return { ...actual, activeLevel: jest.fn() }
})

import { supabase } from '../../config/supabase'
import { enqueueFinaJob } from '../../utils/fina-jobs'
import { activeLevel, ConsentLevel } from './consent-engine.service'
import { confirmTagging } from './media-pipeline.service'

const CALLER = { profileId: 'staff-1', role: 'teacher', schoolId: 'school-1' }

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'update']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  builder.single = jest.fn().mockResolvedValue(result)
  builder.then = (resolve: any) => resolve(result)
  return builder
}

describe('media-pipeline.service — confirmTagging', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('refuses to confirm when zero tags exist and no_identifiable_students was never set', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_media') {
        return makeQueryBuilder({ data: { id: 'm1', school_id: 'school-1', processing_state: 'pending_tagging', no_identifiable_students: false }, error: null })
      }
      if (table === 'fina_face_tags') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    await expect(confirmTagging(CALLER, 'm1')).rejects.toThrow(/Tag the students|no identifiable/i)
    expect(enqueueFinaJob).not.toHaveBeenCalled()
  })

  it('confirms with SCHOOL_SCOPE and has_unconsented=false when staff explicitly attested "no identifiable students"', async () => {
    let updatePayload: any = null
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_media') {
        const builder = makeQueryBuilder({ data: { id: 'm1', school_id: 'school-1', processing_state: 'pending_tagging', no_identifiable_students: true }, error: null })
        builder.update = jest.fn((payload: any) => {
          updatePayload = payload
          return makeQueryBuilder({ data: { id: 'm1', ...payload }, error: null })
        })
        return builder
      }
      if (table === 'fina_face_tags') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: null, error: null })
    })

    const result = await confirmTagging(CALLER, 'm1')

    expect(updatePayload.min_consent_level).toBe(ConsentLevel.SCHOOL_SCOPE)
    expect(updatePayload.has_unconsented).toBe(false)
    expect(updatePayload.processing_state).toBe('pending_variants')
    expect(enqueueFinaJob).toHaveBeenCalledWith('generate_media_variants', { mediaId: 'm1' }, 3)
    expect(result).not.toHaveProperty('storage_key')
  })

  it('forces DENY_ALL and has_unconsented=true when any tag is an unresolved/unidentified face', async () => {
    let updatePayload: any = null
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_media') {
        const builder = makeQueryBuilder({ data: { id: 'm2', school_id: 'school-1', processing_state: 'pending_tagging', no_identifiable_students: false }, error: null })
        builder.update = jest.fn((payload: any) => {
          updatePayload = payload
          return makeQueryBuilder({ data: { id: 'm2', ...payload }, error: null })
        })
        return builder
      }
      if (table === 'fina_face_tags') {
        return makeQueryBuilder({ data: [{ student_id: 'student-a' }, { student_id: null }], error: null })
      }
      return makeQueryBuilder({ data: null, error: null })
    })
    ;(activeLevel as unknown as jest.Mock).mockResolvedValue(ConsentLevel.SCHOOL_SCOPE) // even a wide grant on the identified student must not matter

    await confirmTagging(CALLER, 'm2')

    expect(updatePayload.min_consent_level).toBe(ConsentLevel.DENY_ALL)
    expect(updatePayload.has_unconsented).toBe(true)
  })

  // Multi-student MOST-RESTRICTIVE aggregation is exercised directly against
  // computeScopeFromTags's own dependency (activeLevel's real Supabase call)
  // in consent-engine.test.ts — not repeated here. Jest can't intercept
  // computeScopeFromTags's internal same-module call to activeLevel via a
  // jest.mock(..., () => ({ ...actual, activeLevel: jest.fn() })) spread
  // (same-module function calls resolve to the local binding, not the
  // mocked export), so a true multi-student case here would need mocking
  // Supabase's fina_consents responses per student_id instead — redundant
  // with the coverage consent-engine.test.ts already has.
})
