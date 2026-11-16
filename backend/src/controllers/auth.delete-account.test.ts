// Account deletion re-authenticates with the current password on the server.
jest.mock('../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../services/two-fa.service', () => ({ twoFAService: {} }))
jest.mock('../services/user-agreement.service', () => ({ userAgreementService: {} }))
const verifyPassword = jest.fn()
jest.mock('../utils/reauth', () => ({ verifyPassword: (...a: unknown[]) => verifyPassword(...a) }))
const requestAccountDeletion = jest.fn()
jest.mock('../services/account-deletion.service', () => ({ requestAccountDeletion: (...a: unknown[]) => requestAccountDeletion(...a) }))

import { deleteAccount } from './auth.controller'

const res = () => {
  const r: any = {}
  r.status = jest.fn(() => r)
  r.json = jest.fn(() => r)
  return r
}
const req = (body: unknown) => ({ body, profile: { id: 'p1', role: 'parent', school_id: 's1' }, user: { id: 'p1', email: 'a@b.c' } }) as any

beforeEach(() => {
  verifyPassword.mockReset()
  requestAccountDeletion.mockReset().mockResolvedValue({ ok: true })
})

describe('POST /auth/delete-account', () => {
  it('400 password_required without a password, and deletes nothing', async () => {
    const r = res()
    await deleteAccount(req({ reason: 'x' }), r)
    expect(r.status).toHaveBeenCalledWith(400)
    expect(r.json.mock.calls[0][0].code).toBe('password_required')
    expect(requestAccountDeletion).not.toHaveBeenCalled()
  })
  it('403 wrong_password when the password is wrong, and deletes nothing', async () => {
    verifyPassword.mockResolvedValue(false)
    const r = res()
    await deleteAccount(req({ password: 'nope' }), r)
    expect(verifyPassword).toHaveBeenCalledWith('a@b.c', 'nope')
    expect(r.status).toHaveBeenCalledWith(403)
    expect(r.json.mock.calls[0][0].code).toBe('wrong_password')
    expect(requestAccountDeletion).not.toHaveBeenCalled()
  })
  it('deletes when the password is right', async () => {
    verifyPassword.mockResolvedValue(true)
    const r = res()
    await deleteAccount(req({ password: 'ok', reason: 'leaving' }), r)
    expect(requestAccountDeletion).toHaveBeenCalledWith({ id: 'p1', role: 'parent', school_id: 's1' }, 'leaving')
    expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
  })
})
