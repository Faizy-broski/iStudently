/** Moderation actions must not touch another school's post, even with a valid post id. */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./audit-logger.service', () => ({ logAuditFromCaller: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./consent-gate.service', () => ({ assertPublishable: jest.fn().mockResolvedValue(undefined) }))
jest.mock('./notifications.service', () => ({ notifyPublishBlockedToOfficers: jest.fn(), notifyNewPost: jest.fn() }))

import { supabase } from '../../config/supabase'
import { assertPublishable } from './consent-gate.service'
import { acknowledgePostHocReview, approvePost, pinPost, rejectApproval, reviewPost } from './moderation.service'

const OFFICER = { profileId: 'm1', role: 'media_officer', schoolId: 'school-1' }
const ADMIN = { profileId: 'a1', role: 'admin', schoolId: 'school-1' }

const update = jest.fn()
function foreignPost() {
  const builder: any = { update }
  for (const method of ['select', 'eq']) builder[method] = jest.fn().mockReturnValue(builder)
  builder.maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'p1', school_id: 'school-2', state: 'pending_approval' }, error: null })
  return builder
}

describe('fina moderation: school scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabase.from as unknown as jest.Mock).mockImplementation(foreignPost)
  })

  it.each([
    ['review approve', () => reviewPost(OFFICER, 'p1', 'approve')],
    ['review reject', () => reviewPost(OFFICER, 'p1', 'reject', 'no')],
    ['approve', () => approvePost(ADMIN, 'p1')],
    ['reject approval', () => rejectApproval(ADMIN, 'p1', 'no')],
    ['post-hoc review', () => acknowledgePostHocReview(OFFICER, 'p1')],
    ['pin', () => pinPost(ADMIN, 'p1', true)],
  ])('refuses %s on another school\'s post without writing', async (_name, run) => {
    await expect(run()).rejects.toThrow(/Access denied/)
    expect(update).not.toHaveBeenCalled()
    expect(assertPublishable).not.toHaveBeenCalled()
  })
})
