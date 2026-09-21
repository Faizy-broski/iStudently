import { decideStaffModuleAccess, resolveApiArea, ModulePermission } from './module-access.service'

const grant = (module_key: string, can_edit = false): ModulePermission => ({ module_key, can_use: true, can_edit })

describe('resolveApiArea', () => {
  it('strips the /api prefix and takes the first segment', () => {
    expect(resolveApiArea('/api/fees/payments')).toBe('fees')
    expect(resolveApiArea('/fees')).toBe('fees')
    expect(resolveApiArea('/api')).toBe('')
    expect(resolveApiArea('')).toBe('')
  })
})

describe('decideStaffModuleAccess', () => {
  const perms = [grant('/admin/fees/payments'), grant('/admin/students/student-info', true)]

  it('allows reads with can_use on a module under the area', () => {
    expect(decideStaffModuleAccess(perms, '/api/fees', 'GET').allowed).toBe(true)
  })

  it('requires can_edit for writes', () => {
    expect(decideStaffModuleAccess(perms, '/api/fees', 'POST').allowed).toBe(false)
    expect(decideStaffModuleAccess(perms, '/api/students', 'PUT').allowed).toBe(true)
  })

  it('denies areas the role does not grant', () => {
    expect(decideStaffModuleAccess(perms, '/api/salary', 'GET').allowed).toBe(false)
  })

  it('denies unmapped areas by default', () => {
    expect(decideStaffModuleAccess(perms, '/api/some-new-router', 'GET').allowed).toBe(false)
  })

  it('never opens account/role management areas', () => {
    const all = [grant('/admin/settings/user-profiles', true), grant('/admin/staff', true)]
    expect(decideStaffModuleAccess(all, '/api/user-profiles', 'GET').allowed).toBe(false)
    expect(decideStaffModuleAccess(all, '/api/credentials', 'POST').allowed).toBe(false)
    expect(decideStaffModuleAccess(all, '/api/school-settings', 'PUT').allowed).toBe(false)
  })

  it('lets a granted edit really edit (no module is silently read-only)', () => {
    const p = [grant('/admin/staff', true), grant('/admin/school-details', true)]
    expect(decideStaffModuleAccess(p, '/api/staff', 'POST').allowed).toBe(true)
    expect(decideStaffModuleAccess(p, '/api/schools/abc', 'PUT').allowed).toBe(true)
  })

  it('opens lookup reads to modules whose pages depend on them, but not writes', () => {
    const fees = [grant('/admin/fees/payments', true)]
    expect(decideStaffModuleAccess(fees, '/api/academics/grade-levels', 'GET').allowed).toBe(true)
    expect(decideStaffModuleAccess(fees, '/api/academics/grade-levels', 'POST').allowed).toBe(false)
  })

  it('uses the full URL so root-mounted routers resolve to their own area', () => {
    const p = [grant('/admin/discipline', true)]
    expect(decideStaffModuleAccess(p, '/api/discipline/referrals?x=1', 'GET').allowed).toBe(true)
  })

  it('does not treat a sibling folder as a match (fees vs fees-extra)', () => {
    expect(decideStaffModuleAccess([grant('/admin/fees-extra/x')], '/api/fees', 'GET').allowed).toBe(false)
  })

  it('lets any granted user reach shared helper endpoints', () => {
    expect(decideStaffModuleAccess(perms, '/api/export-templates', 'GET').allowed).toBe(true)
    expect(decideStaffModuleAccess([], '/api/export-templates', 'GET').allowed).toBe(false)
  })
})
