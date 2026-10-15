jest.mock('../config/supabase', () => ({
  supabase: { from: jest.fn(), auth: { admin: { getUserById: jest.fn() } } },
}))
jest.mock('../services/two-fa.service', () => ({ twoFAService: {} }))
jest.mock('../services/user-agreement.service', () => ({ userAgreementService: {} }))
jest.mock('../utils/campus-validation', () => ({ campusIdsAllowed: jest.fn() }))

import { supabase } from '../config/supabase'
import { campusIdsAllowed } from '../utils/campus-validation'
import { getLastLogin } from './auth.controller'

function res() {
  const r: any = {}
  r.status = jest.fn(() => r)
  r.json = jest.fn(() => r)
  return r
}
function profileRow(school_id: string | null) {
  const b: any = {}
  b.select = () => b
  b.eq = () => b
  b.maybeSingle = async () => ({ data: school_id ? { school_id } : null })
  return b
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(supabase.auth.admin.getUserById as jest.Mock).mockResolvedValue({ data: { user: { last_sign_in_at: '2026-10-01T08:00:00Z' } }, error: null })
})

describe('GET /auth/last-login/:profileId', () => {
  it('returns the time for someone in the same school family', async () => {
    ;(supabase.from as jest.Mock).mockReturnValue(profileRow('campus-a1'))
    ;(campusIdsAllowed as jest.Mock).mockResolvedValue(true)
    const r = res()
    await getLastLogin({ params: { profileId: 'u1' }, profile: { role: 'admin', school_id: 'main-a' } } as any, r)
    expect(r.json).toHaveBeenCalledWith({ success: true, data: { last_sign_in: '2026-10-01T08:00:00Z' } })
  })

  it("hides people from other schools (404) and never asks Supabase Auth", async () => {
    ;(supabase.from as jest.Mock).mockReturnValue(profileRow('campus-b1'))
    ;(campusIdsAllowed as jest.Mock).mockResolvedValue(false)
    const r = res()
    await getLastLogin({ params: { profileId: 'u2' }, profile: { role: 'admin', school_id: 'main-a' } } as any, r)
    expect(r.status).toHaveBeenCalledWith(404)
    expect(supabase.auth.admin.getUserById).not.toHaveBeenCalled()
  })

  it('super admin may look up anyone', async () => {
    const r = res()
    await getLastLogin({ params: { profileId: 'u3' }, profile: { role: 'super_admin', school_id: null } } as any, r)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(r.json).toHaveBeenCalledWith({ success: true, data: { last_sign_in: '2026-10-01T08:00:00Z' } })
  })
})
