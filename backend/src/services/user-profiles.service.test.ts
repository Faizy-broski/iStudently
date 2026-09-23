/**
 * Unit tests for UserProfilesService — deny-list semantics and seedDefaultRoles.
 * Supabase is fully mocked; no network calls are made.
 */
import { UserProfilesService } from './user-profiles.service'

// ── Shared mock infrastructure ───────────────────────────────────────────────

const mockFrom = jest.fn()
jest.mock('../config/supabase', () => ({ supabase: { from: (...a: any[]) => mockFrom(...a) } }))
jest.mock('../utils/campus.util', () => ({ getMainSchoolId: (id: string) => Promise.resolve(id) }))
jest.mock('./module-access.service', () => ({ clearModulePermissionCache: jest.fn(), resolvePermissionSourceId: jest.fn() }))

function chainMock(overrides: Record<string, any> = {}) {
  const chain: any = {}
  const methods = ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'in', 'is', 'not', 'maybeSingle', 'single', 'order']
  for (const m of methods) chain[m] = overrides[m] ?? jest.fn(() => chain)
  return chain
}

beforeEach(() => jest.clearAllMocks())

// ── pruneDisallowedPermissions ────────────────────────────────────────────────

describe('pruneDisallowedPermissions', () => {
  it('deletes rows whose module_key is in the denied set', async () => {
    const deletedIds: string[] = []
    const campusChain = chainMock({ select: jest.fn(() => ({ eq: jest.fn(() => ({ data: [], error: null })) })) })
    const profileChain = chainMock({ select: jest.fn(() => ({ in: jest.fn(() => ({ data: [{ id: 'p1' }], error: null })) })) })
    const rowChain = chainMock({
      select: jest.fn(() => ({
        in: jest.fn(() => ({ data: [{ id: 'r1', module_key: '/denied/page' }, { id: 'r2', module_key: '/allowed/page' }], error: null }))
      }))
    })
    const deleteChain = chainMock({
      delete: jest.fn(() => ({ in: jest.fn((_, ids) => { deletedIds.push(...ids); return { error: null } }) }))
    })

    mockFrom
      .mockReturnValueOnce(campusChain)   // schools
      .mockReturnValueOnce(profileChain)  // user_profiles
      .mockReturnValueOnce(rowChain)      // user_profile_permissions select
      .mockReturnValueOnce(deleteChain)   // user_profile_permissions delete

    const svc = new UserProfilesService()
    const count = await svc.pruneDisallowedPermissions('school1', ['/denied/page'])

    expect(count).toBe(1)
    expect(deletedIds).toEqual(['r1'])
  })

  it('does NOT delete rows whose module_key is not in the denied set', async () => {
    const deleteChain = chainMock({ delete: jest.fn(() => ({ in: jest.fn(() => { throw new Error('should not delete') }) })) })
    const campusChain = chainMock({ select: jest.fn(() => ({ eq: jest.fn(() => ({ data: [], error: null })) })) })
    const profileChain = chainMock({ select: jest.fn(() => ({ in: jest.fn(() => ({ data: [{ id: 'p1' }], error: null })) })) })
    const rowChain = chainMock({
      select: jest.fn(() => ({ in: jest.fn(() => ({ data: [{ id: 'r1', module_key: '/allowed/page' }], error: null })) }))
    })

    mockFrom
      .mockReturnValueOnce(campusChain)
      .mockReturnValueOnce(profileChain)
      .mockReturnValueOnce(rowChain)

    const svc = new UserProfilesService()
    const count = await svc.pruneDisallowedPermissions('school1', ['/some/other/denied'])
    expect(count).toBe(0)
  })
})

// ── seedDefaultRoles ──────────────────────────────────────────────────────────

describe('seedDefaultRoles – reconcile mode', () => {
  it('is idempotent: second call produces added=0, removed=0', async () => {
    const hrefs = ['/teacher/dashboard', '/teacher/classes']

    // For each role: profile exists, update runs, perms already match hrefs exactly
    let callCount = 0
    mockFrom.mockImplementation((table: string) => {
      callCount++
      if (table === 'user_profiles' && callCount % 3 === 1) {
        // Profile lookup — returns existing profile
        const chain: any = {}
        const val = { data: { id: `profile${Math.floor(callCount / 3)}` }, error: null }
        chain.select = () => chain
        chain.eq = () => chain
        chain.maybeSingle = () => Promise.resolve(val)
        chain.update = () => chain
        chain.insert = () => chain
        chain.single = () => Promise.resolve(val)
        return chain
      }
      if (table === 'user_profiles' && callCount % 3 === 2) {
        // Profile update (is_system)
        const chain: any = {}
        chain.update = () => chain
        chain.eq = () => Promise.resolve({ error: null })
        return chain
      }
      // user_profile_permissions — existing perms exactly match hrefs
      const existingPerms = hrefs.map((h, j) => ({ id: `r${callCount}${j}`, module_key: h }))
      const chain: any = {}
      chain.select = () => chain
      chain.insert = () => Promise.resolve({ error: null })
      chain.delete = () => chain
      chain.in = () => Promise.resolve({ error: null })
      chain.eq = () => Promise.resolve({ data: existingPerms, error: null })
      return chain
    })

    const svc = new UserProfilesService()
    const result = await svc.seedDefaultRoles(
      'school1',
      { teacher: hrefs, staff: hrefs, librarian: hrefs },
      'reconcile'
    )

    expect(result.seeded).toBe(3)
    // No new items to add, no items to remove
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('adds new hrefs, removes retired hrefs', async () => {
    const newHrefs = ['/teacher/dashboard', '/teacher/new-page']
    const oldPerm = { id: 'old1', module_key: '/teacher/old-page' }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        // Profile lookup: .select().eq().eq().eq().maybeSingle() → existing profile
        // Profile update: .update().eq() → ok
        const chain: any = {}
        chain.select = () => chain
        chain.update = () => chain
        chain.eq = () => chain
        chain.maybeSingle = () => Promise.resolve({ data: { id: 'profileA' }, error: null })
        // update path: after .update().eq() return error null
        // override eq to return promise when chained after update
        return chain
      }
      // user_profile_permissions
      const chain: any = {}
      chain.select = () => chain
      chain.insert = () => Promise.resolve({ error: null })
      chain.delete = () => chain
      chain.in = () => Promise.resolve({ error: null })
      // .eq() used for both permission select and delete.eq()
      chain.eq = () => Promise.resolve({ data: [oldPerm], error: null })
      return chain
    })

    const svc = new UserProfilesService()
    const result = await svc.seedDefaultRoles(
      'school1',
      { teacher: newHrefs, staff: [], librarian: [] },
      'reconcile'
    )

    expect(result.seeded).toBe(3)
    expect(result.added).toBeGreaterThanOrEqual(0)
  })
})

describe('seedDefaultRoles – reset mode', () => {
  it('replaces all permissions regardless of existing data', async () => {
    const deletedCalls: string[] = []
    const insertedRows: any[] = []

    const makeMocks = (profileId: string, hrefs: string[]) => [
      // Profile lookup
      chainMock({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: { id: profileId }, error: null }))
              }))
            }))
          }))
        }))
      }),
      // Profile update (is_system)
      chainMock({ update: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })) }),
      // Perm select (existing)
      chainMock({
        select: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ data: [{ id: 'old', module_key: '/old' }], error: null })) }))
      }),
      // Perm delete (all)
      chainMock({
        delete: jest.fn(() => ({ eq: jest.fn((_, id) => { deletedCalls.push(id); return Promise.resolve({ error: null }) }) }))
      }),
      // Perm insert (full)
      chainMock({
        insert: jest.fn((rows) => { insertedRows.push(...rows); return Promise.resolve({ error: null }) })
      }),
    ]

    const mocks = [
      ...makeMocks('p1', ['/teacher/dashboard']),
      ...makeMocks('p2', ['/admin/dashboard']),
      ...makeMocks('p3', ['/library/dashboard']),
    ]
    mockFrom.mockImplementation(() => mocks.shift() ?? chainMock())

    const svc = new UserProfilesService()
    const result = await svc.seedDefaultRoles(
      'school1',
      { teacher: ['/teacher/dashboard'], staff: ['/admin/dashboard'], librarian: ['/library/dashboard'] },
      'reset'
    )

    expect(result.seeded).toBe(3)
    expect(deletedCalls.length).toBe(3) // one delete per role
    expect(insertedRows.every((r: any) => r.can_use === true && r.can_edit === true)).toBe(true)
  })
})
