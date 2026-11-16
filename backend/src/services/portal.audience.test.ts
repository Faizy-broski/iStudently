// Portal notes/polls: audience, active flag and date window apply when addressed by id or answered.
jest.mock('../config/supabase', () => ({ supabase: { from: jest.fn() } }))

import { portalAudienceAllows } from './portal.service'

const now = new Date('2026-11-16T12:00:00Z')
const row = (o: Record<string, unknown> = {}) => ({ is_active: true, visible_to_roles: ['parent', 'teacher'], visible_from: null, visible_until: null, ...o })

describe('portalAudienceAllows', () => {
  it('admits a role in the audience inside an open window', () => {
    expect(portalAudienceAllows(row(), 'parent', now)).toBe(true)
    expect(portalAudienceAllows(row({ visible_from: '2026-11-01T00:00:00Z', visible_until: '2026-12-01T00:00:00Z' }), 'parent', now)).toBe(true)
  })
  it('refuses a role outside the audience', () => {
    expect(portalAudienceAllows(row({ visible_to_roles: ['teacher'] }), 'parent', now)).toBe(false)
    expect(portalAudienceAllows(row({ visible_to_roles: null }), 'parent', now)).toBe(false)
  })
  it('refuses inactive, not-yet-open and expired items', () => {
    expect(portalAudienceAllows(row({ is_active: false }), 'parent', now)).toBe(false)
    expect(portalAudienceAllows(row({ visible_from: '2026-12-01T00:00:00Z' }), 'parent', now)).toBe(false)
    expect(portalAudienceAllows(row({ visible_until: '2026-11-01T00:00:00Z' }), 'parent', now)).toBe(false)
  })
  it('always admits admins and super admins', () => {
    expect(portalAudienceAllows(row({ is_active: false, visible_to_roles: [] }), 'admin', now)).toBe(true)
    expect(portalAudienceAllows(row({ visible_until: '2020-01-01T00:00:00Z' }), 'super_admin', now)).toBe(true)
  })
  it('refuses a caller without a role', () => {
    expect(portalAudienceAllows(row(), undefined, now)).toBe(false)
  })
})
