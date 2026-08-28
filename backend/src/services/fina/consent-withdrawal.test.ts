/**
 * Contributes to AT-04 ("consent withdrawal -> hidden/blurred across the
 * entire archive within SLA"): confirms the reprocessing job actually
 * restricts a published post once a withdrawal drops the underlying
 * media's scope below what that post's audience requires — and, just as
 * important, confirms it does NOT touch a post that's still compliant.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./jobs-runner.service', () => ({ registerFinaJobHandler: jest.fn() }))
jest.mock('./notifications.service', () => ({ notifyConsentWithdrawnToPrincipal: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./consent-engine.service', () => {
  const actual = jest.requireActual('./consent-engine.service')
  return { ...actual, computeScopeFromTags: jest.fn() }
})

import { supabase } from '../../config/supabase'
import { computeScopeFromTags, ConsentLevel } from './consent-engine.service'
import { notifyConsentWithdrawnToPrincipal } from './notifications.service'
import { handleReprocessStudentArchive } from './consent-withdrawal.service'

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'in', 'update']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result)
  builder.then = (resolve: any) => resolve(result)
  return builder
}

const SCHOOL_A = 'school-a'
const MEDIA_ID = 'media-1'
const POST_STILL_COMPLIANT = 'post-compliant'
const POST_NOW_RESTRICTED = 'post-restricted'

describe('consent-withdrawal.service — handleReprocessStudentArchive', () => {
  beforeEach(() => jest.clearAllMocks())

  it('★ restricts a published post whose audience no longer clears the recomputed (lowered) scope', async () => {
    const restrictCalls: any[] = []
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_face_tags') return makeQueryBuilder({ data: [{ media_id: MEDIA_ID }], error: null })
      if (table === 'fina_media') {
        const builder = makeQueryBuilder({ data: { id: MEDIA_ID, school_id: SCHOOL_A, processing_state: 'ready' }, error: null })
        builder.update = jest.fn().mockReturnValue(builder)
        return builder
      }
      if (table === 'fina_post_media') return makeQueryBuilder({ data: [{ post_id: POST_NOW_RESTRICTED }], error: null })
      if (table === 'fina_posts') {
        const builder = makeQueryBuilder({ data: { id: POST_NOW_RESTRICTED, audience_type: 'school', state: 'published' }, error: null })
        builder.update = jest.fn((payload: any) => {
          restrictCalls.push(payload)
          return makeQueryBuilder({ data: null, error: null })
        })
        return builder
      }
      return makeQueryBuilder({ data: null, error: null })
    })
    ;(computeScopeFromTags as unknown as jest.Mock).mockResolvedValue(ConsentLevel.INNER_CIRCLE) // below 'school' audience's required SCHOOL_SCOPE

    await handleReprocessStudentArchive({ studentId: 'student-1' })

    expect(restrictCalls).toEqual([{ state: 'restricted' }])
    expect(notifyConsentWithdrawnToPrincipal).toHaveBeenCalledWith(SCHOOL_A)
  })

  it('does not restrict a published post whose audience still clears the recomputed scope', async () => {
    const restrictCalls: any[] = []
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_face_tags') return makeQueryBuilder({ data: [{ media_id: MEDIA_ID }], error: null })
      if (table === 'fina_media') {
        const builder = makeQueryBuilder({ data: { id: MEDIA_ID, school_id: SCHOOL_A, processing_state: 'ready' }, error: null })
        builder.update = jest.fn().mockReturnValue(builder)
        return builder
      }
      if (table === 'fina_post_media') return makeQueryBuilder({ data: [{ post_id: POST_STILL_COMPLIANT }], error: null })
      if (table === 'fina_posts') {
        const builder = makeQueryBuilder({ data: { id: POST_STILL_COMPLIANT, audience_type: 'classes', state: 'published' }, error: null })
        builder.update = jest.fn((payload: any) => {
          restrictCalls.push(payload)
          return makeQueryBuilder({ data: null, error: null })
        })
        return builder
      }
      return makeQueryBuilder({ data: null, error: null })
    })
    ;(computeScopeFromTags as unknown as jest.Mock).mockResolvedValue(ConsentLevel.SCHOOL_SCOPE) // still clears 'classes' audience's CLASS_SCOPE requirement

    await handleReprocessStudentArchive({ studentId: 'student-2' })

    expect(restrictCalls).toEqual([])
  })

  it('Phase 6: an explicit payload.mediaIds (the student-deletion hook path) never looks up fina_face_tags by student_id, since that row is already gone by the time this runs', async () => {
    const faceTagsEqCalls: any[][] = []
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_face_tags') {
        const builder = makeQueryBuilder({ data: [{ student_id: null }], error: null }) // the tag is already unidentified — ON DELETE SET NULL already fired
        const originalEq = builder.eq
        builder.eq = jest.fn((...args: any[]) => { faceTagsEqCalls.push(args); return originalEq(...args) })
        return builder
      }
      if (table === 'fina_media') {
        const builder = makeQueryBuilder({ data: { id: MEDIA_ID, school_id: SCHOOL_A, processing_state: 'ready' }, error: null })
        builder.update = jest.fn().mockReturnValue(builder)
        return builder
      }
      return makeQueryBuilder({ data: [], error: null })
    })
    ;(computeScopeFromTags as unknown as jest.Mock).mockResolvedValue(ConsentLevel.DENY_ALL)

    await handleReprocessStudentArchive({ studentId: 'student-3', mediaIds: [MEDIA_ID] })

    expect(faceTagsEqCalls.some(([col]) => col === 'student_id')).toBe(false)
    expect(faceTagsEqCalls.some(([col]) => col === 'media_id')).toBe(true)
  })

  it('throws when the payload carries neither studentId nor mediaIds', async () => {
    await expect(handleReprocessStudentArchive({})).rejects.toThrow('missing studentId/mediaIds')
  })
})
