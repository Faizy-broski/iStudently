const calls: string[] = []
let insertError: { code: string } | null = null

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: async () => (calls.push(`insert:${table}`), { error: insertError }),
      update: (v: Record<string, unknown>) => ({ eq: async () => (calls.push(`update:${table}:${JSON.stringify(v)}`), { error: null }) }),
    }),
    auth: { admin: { updateUserById: async (id: string, v: { ban_duration: string }) => (calls.push(`ban:${id}:${v.ban_duration}`), { error: null }) } },
  },
}))

import { requestAccountDeletion } from './account-deletion.service'

beforeEach(() => {
  calls.length = 0
  insertError = null
})

describe('requestAccountDeletion', () => {
  it('records the request, deactivates the profile and bans the auth user', async () => {
    expect(await requestAccountDeletion({ id: 'u1', role: 'parent', school_id: 's1' }, 'bye')).toEqual({ ok: true })
    expect(calls).toEqual(['insert:account_deletion_requests', 'update:profiles:{"is_active":false}', 'ban:u1:876000h'])
  })
  it('still turns sign-in off when a request is already open', async () => {
    insertError = { code: '23505' }
    expect(await requestAccountDeletion({ id: 'u1', role: 'student' })).toEqual({ ok: true })
    expect(calls).toContain('ban:u1:876000h')
  })
  it('refuses the platform super admin account', async () => {
    expect(await requestAccountDeletion({ id: 'u1', role: 'super_admin' })).toMatchObject({ ok: false, status: 400 })
    expect(calls).toEqual([])
  })
  it('reports a missing table as not migrated without touching the account', async () => {
    insertError = { code: 'PGRST205' }
    expect(await requestAccountDeletion({ id: 'u1', role: 'teacher' })).toMatchObject({ ok: false, status: 503, code: 'not_migrated' })
    expect(calls).toEqual(['insert:account_deletion_requests'])
  })
})
