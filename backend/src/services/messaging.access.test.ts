// Students message only people of their school family, and a reply joins a thread only when the
// sender is part of the message replied to.
const db: Record<string, (f: Record<string, unknown>) => unknown> = {}
let inserted = 0
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const f: Record<string, unknown> = {}
      let write = false
      const b: any = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => ((f[c] = v), b)
      b.in = (c: string, v: unknown) => ((f[c] = v), b)
      b.limit = () => b
      b.insert = () => ((write = true), inserted++, b)
      const run = async () => (write ? { data: { id: 'm-new' }, error: null } : { data: db[table]?.(f) ?? null, error: null })
      b.single = run
      b.maybeSingle = run
      b.then = (resolve: any) => run().then(resolve)
      return b
    },
  },
}))
jest.mock('../utils/campus-validation', () => ({
  campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((id) => id === 's1'),
}))
jest.mock('./message-substitution.service', () => ({ substituteMessageTokens: jest.fn(), resolveRecipientSubstitutionData: jest.fn() }))

import { MessagingAccessError, MessagingService } from './messaging.service'

const svc = new MessagingService()
const base = { schoolId: 's1', senderProfileId: 'p-stu', senderRole: 'student', subject: 'Hi', body: 'Hello' }

beforeEach(() => {
  inserted = 0
  db.profiles = (f) => ((f.id as string[]) ?? []).map((id) => ({ id, school_id: id === 'p-far' ? 's9' : 's1' }))
  db.message_recipients = () => []
})

it('rejects a student messaging another school', async () => {
  await expect(svc.sendMessage({ ...base, recipientProfileIds: ['p-near', 'p-far'] })).rejects.toBeInstanceOf(MessagingAccessError)
  expect(inserted).toBe(0)
})

it('rejects a reply to a thread the sender is not part of', async () => {
  await expect(svc.sendMessage({ ...base, recipientProfileIds: ['p-near'], replyToMessageId: 'm-foreign' })).rejects.toBeInstanceOf(MessagingAccessError)
  expect(inserted).toBe(0)
})
