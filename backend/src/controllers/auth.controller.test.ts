jest.mock('../config/supabase', () => ({
  supabase: { from: jest.fn() },
}))
jest.mock('../services/two-fa.service', () => ({
  twoFAService: {
    isTwoFARequiredForRole: jest.fn(),
    extractSessionId: jest.fn(),
    isSessionVerified: jest.fn(),
  },
}))
jest.mock('../services/user-agreement.service', () => ({
  userAgreementService: { checkUser: jest.fn() },
}))

import { supabase } from '../config/supabase'
import { twoFAService } from '../services/two-fa.service'
import { userAgreementService } from '../services/user-agreement.service'
import { getMe } from './auth.controller'

// GET /auth/me is exempt from the 2FA block, so it must never return secret columns.

function chainable(data: any) {
  const obj: any = {}
  for (const m of ['select', 'eq', 'is']) obj[m] = jest.fn(() => obj)
  obj.maybeSingle = jest.fn(() => Promise.resolve({ data }))
  return obj
}

const tables: Record<string, any> = {}

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const baseProfile = {
  id: 'p1',
  role: 'teacher',
  email: 't@school.test',
  username: 'teach',
  first_name: 'T',
  last_name: 'One',
  school_id: 's1',
  campus_id: 'c1',
  staff_id: 'st1',
  language_preference: 'ar',
  force_password_change: false,
  totp_enabled: true,
  totp_secret: 'SECRET-TOTP',
  totp_recovery_codes: ['RC1'],
  login_password_enc: 'ENC-PASSWORD',
}

beforeEach(() => {
  jest.clearAllMocks()
  tables.schools = { id: 'c1', name: 'Campus', short_name: null, parent_school_id: null, logo_url: 'logo.png' }
  tables.school_settings = { active_plugins: { miqat: true, hifzi: false }, logo_shape: 'circle' }
  ;(supabase.from as jest.Mock).mockImplementation((t: string) => chainable(tables[t] ?? null))
  ;(twoFAService.isTwoFARequiredForRole as jest.Mock).mockResolvedValue(false)
  ;(userAgreementService.checkUser as jest.Mock).mockResolvedValue({ must_accept: false, blocked: false })
})

async function callMe(profile: any) {
  const res = mockRes()
  await getMe({ profile, headers: { authorization: 'Bearer x.y.z' } } as any, res)
  return res.json.mock.calls[0][0]
}

describe('GET /auth/me', () => {
  it('returns safe profile fields only', async () => {
    const body = await callMe({ ...baseProfile })
    const text = JSON.stringify(body)
    expect(text).not.toContain('SECRET-TOTP')
    expect(text).not.toContain('ENC-PASSWORD')
    expect(text).not.toContain('RC1')
    expect(body.data.profile).toMatchObject({ id: 'p1', role: 'teacher', language: 'ar', staff_id: 'st1' })
  })

  it('lists enabled plugins only', async () => {
    const body = await callMe({ ...baseProfile })
    expect(body.data.plugins).toEqual(['miqat'])
  })

  it('2FA not required -> ok', async () => {
    const body = await callMe({ ...baseProfile })
    expect(body.data.gates.two_fa.state).toBe('ok')
  })

  it('2FA required, not enabled -> setup_required', async () => {
    ;(twoFAService.isTwoFARequiredForRole as jest.Mock).mockResolvedValue(true)
    const body = await callMe({ ...baseProfile, totp_enabled: false })
    expect(body.data.gates.two_fa.state).toBe('setup_required')
  })

  it('2FA required, session not verified -> verify_required', async () => {
    ;(twoFAService.isTwoFARequiredForRole as jest.Mock).mockResolvedValue(true)
    ;(twoFAService.extractSessionId as jest.Mock).mockReturnValue('sess')
    ;(twoFAService.isSessionVerified as jest.Mock).mockResolvedValue(false)
    const body = await callMe({ ...baseProfile })
    expect(body.data.gates.two_fa.state).toBe('verify_required')
  })

  it('2FA required, session verified -> ok', async () => {
    ;(twoFAService.isTwoFARequiredForRole as jest.Mock).mockResolvedValue(true)
    ;(twoFAService.extractSessionId as jest.Mock).mockReturnValue('sess')
    ;(twoFAService.isSessionVerified as jest.Mock).mockResolvedValue(true)
    const body = await callMe({ ...baseProfile })
    expect(body.data.gates.two_fa.state).toBe('ok')
  })

  it('2FA grace period -> ok with skip_until', async () => {
    ;(twoFAService.isTwoFARequiredForRole as jest.Mock).mockResolvedValue(true)
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const body = await callMe({ ...baseProfile, totp_enabled: false, totp_skip_until: future })
    expect(body.data.gates.two_fa).toMatchObject({ state: 'ok', skip_until: future })
  })

  it('reports forced password change and agreement gates', async () => {
    ;(userAgreementService.checkUser as jest.Mock).mockResolvedValue({ must_accept: true, blocked: false })
    const body = await callMe({ ...baseProfile, force_password_change: true })
    expect(body.data.gates.force_password_change).toBe(true)
    expect(body.data.gates.agreement).toMatchObject({ must_accept: true, blocked: false })
  })

  it('agreement lookup failure does not fail the request', async () => {
    ;(userAgreementService.checkUser as jest.Mock).mockRejectedValue(new Error('db down'))
    const body = await callMe({ ...baseProfile })
    expect(body.success).toBe(true)
    expect(body.data.gates.agreement).toBeNull()
  })

  it('401 without a profile', async () => {
    const res = mockRes()
    await getMe({ headers: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })
})

describe('GET /auth/me for a super admin without a school', () => {
  it('still checks 2FA exactly like authenticate()', async () => {
    ;(twoFAService.isTwoFARequiredForRole as jest.Mock).mockResolvedValue(true)
    const body = await callMe({ ...baseProfile, role: 'super_admin', school_id: null, campus_id: null, totp_enabled: false })
    expect(twoFAService.isTwoFARequiredForRole).toHaveBeenCalledWith('super_admin', null, null)
    expect(body.data.gates.two_fa.state).toBe('setup_required')
    expect(body.data.plugins).toEqual([])
    expect(body.data.gates.agreement).toBeNull()
  })
})
