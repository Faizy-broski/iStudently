/**
 * Covers rules spec §17/§27 call out as hard requirements: no 'free'/'other'
 * post type, achievement posts force comments off regardless of caller
 * input, and 'urgent' posts are principal-only. AT-06 ("publishing without
 * approval is impossible via any API path") is a structural property of
 * this state machine — approvePost() only ever fires from 'pending_approval',
 * itself only reachable via reviewPost's approve branch from 'pending_review',
 * itself only reachable via submitPost's auto-filter pass — there is no
 * other code path in this file that sets state='published' except the
 * principal-only emergency branch, also gated by the same auto-filter.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./audit-logger.service', () => ({ logAuditFromCaller: jest.fn().mockResolvedValue(undefined) }))

import { supabase } from '../../config/supabase'
import { createPost } from './moderation.service'

const TEACHER = { profileId: 't1', role: 'teacher', schoolId: 'school-1' }
const ADMIN = { profileId: 'a1', role: 'admin', schoolId: 'school-1' }

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  for (const method of ['select', 'eq', 'in', 'insert', 'order']) {
    builder[method] = jest.fn().mockReturnValue(builder)
  }
  builder.single = jest.fn().mockResolvedValue(result)
  builder.then = (resolve: any) => resolve(result)
  return builder
}

describe('moderation.service — createPost', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rejects an invalid/free-form post type', async () => {
    await expect(createPost(TEACHER, { type: 'free' } as any)).rejects.toThrow(/Invalid post type/)
  })

  it('rejects an unrecognized type even if it looks plausible ("other")', async () => {
    await expect(createPost(TEACHER, { type: 'other' } as any)).rejects.toThrow(/Invalid post type/)
  })

  it('refuses a teacher creating an "urgent" post — principal only', async () => {
    await expect(createPost(TEACHER, { type: 'urgent', body: 'Early closure today' })).rejects.toThrow(/Access denied/)
  })

  it('forces comments_enabled=false for an achievement post regardless of caller input', async () => {
    let insertedPayload: any = null
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_posts') {
        const builder = makeQueryBuilder({ data: null, error: null })
        builder.insert = jest.fn((payload: any) => {
          insertedPayload = payload
          return makeQueryBuilder({ data: { id: 'post-1', ...payload }, error: null })
        })
        return builder
      }
      return makeQueryBuilder({ data: null, error: null })
    })

    await createPost(TEACHER, { type: 'achievement', title: 'Well done', comments_enabled: true } as any)

    expect(insertedPayload.comments_enabled).toBe(false)
  })

  it('allows an admin to create an urgent post', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation((table: string) => {
      if (table === 'fina_posts') {
        const builder = makeQueryBuilder({ data: null, error: null })
        builder.insert = jest.fn((payload: any) => makeQueryBuilder({ data: { id: 'post-2', ...payload }, error: null }))
        return builder
      }
      return makeQueryBuilder({ data: null, error: null })
    })

    const result = await createPost(ADMIN, { type: 'urgent', body: 'Early closure today', is_emergency: true } as any)
    expect(result.id).toBe('post-2')
  })
})
