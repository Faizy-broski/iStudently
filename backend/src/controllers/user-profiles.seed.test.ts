const seedDefaultRoles = jest.fn(async () => ({ created: 3 }))
jest.mock('../services/user-profiles.service', () => ({
  UserProfilesService: jest.fn().mockImplementation(() => ({ seedDefaultRoles })),
}))

import { seedDefaults } from './user-profiles.controller'

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const roles = { teacher: [], staff: [], librarian: [] }
const OTHER = '99999999-9999-4999-8999-999999999999'

beforeEach(() => seedDefaultRoles.mockClear())

describe('POST /user-profiles/seed-defaults target school', () => {
  it('super admin can target a school by id (onboarding)', async () => {
    await seedDefaults({ profile: { role: 'super_admin', school_id: null }, body: { roles, mode: 'reset', school_id: OTHER } }, mockRes())
    expect(seedDefaultRoles).toHaveBeenCalledWith(OTHER, roles, 'reset')
  })

  it('a school admin is always limited to their own school', async () => {
    await seedDefaults({ profile: { role: 'admin', school_id: 'own-school' }, body: { roles, school_id: OTHER } }, mockRes())
    expect(seedDefaultRoles).toHaveBeenCalledWith('own-school', roles, 'reconcile')
  })

  it('super admin without school_id keeps the old behaviour (impersonated school)', async () => {
    await seedDefaults({ profile: { role: 'super_admin', school_id: 'impersonated' }, body: { roles } }, mockRes())
    expect(seedDefaultRoles).toHaveBeenCalledWith('impersonated', roles, 'reconcile')
  })

  it('rejects a malformed school_id', async () => {
    const res = mockRes()
    await seedDefaults({ profile: { role: 'super_admin' }, body: { roles, school_id: 'x' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(seedDefaultRoles).not.toHaveBeenCalled()
  })
})
