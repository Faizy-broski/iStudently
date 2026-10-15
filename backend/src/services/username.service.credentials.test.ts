// A super-admin *read* of credentials must not reset the account's real password when asked not to.
const authUpdate = jest.fn(async () => ({ data: {}, error: null }))
let profileRow: any = null
const profileUpdates: any[] = []

jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = {}
      for (const m of ['select', 'eq', 'neq', 'ilike', 'limit', 'order']) b[m] = () => b
      b.update = (v: any) => {
        profileUpdates.push(v)
        return b
      }
      b.maybeSingle = async () => ({ data: profileRow, error: null })
      b.single = async () => ({ data: profileRow, error: null })
      b.then = (r: any) => Promise.resolve({ data: [], error: null }).then(r)
      return b
    },
    auth: { admin: { updateUserById: authUpdate } },
  },
}))
jest.mock('../utils/crypto', () => ({ encryptSecret: (s: string) => `enc:${s}`, decryptSecret: (s: string) => s.replace('enc:', '') }))
jest.mock('../utils/campus-validation', () => ({ validateCampusAccess: async () => true }))

import { getStoredCredentialsAsSuperAdmin } from './username.service'

beforeEach(() => {
  authUpdate.mockClear()
  profileUpdates.length = 0
})

describe('getStoredCredentialsAsSuperAdmin', () => {
  it('returns the stored password', async () => {
    profileRow = { id: 'p', username: 'admin1', login_password_enc: 'enc:Secret-1', school_id: 's' }
    expect(await getStoredCredentialsAsSuperAdmin('p', { regenerateIfMissing: false })).toEqual({
      username: 'admin1',
      password: 'Secret-1',
      has_password: true,
    })
  })

  it('with regenerateIfMissing=false and no stored password: reports it, changes nothing', async () => {
    profileRow = { id: 'p', username: 'admin1', login_password_enc: null, school_id: 's' }
    expect(await getStoredCredentialsAsSuperAdmin('p', { regenerateIfMissing: false })).toEqual({
      username: 'admin1',
      password: null,
      has_password: false,
    })
    expect(authUpdate).not.toHaveBeenCalled()
    expect(profileUpdates).toEqual([])
  })
})
