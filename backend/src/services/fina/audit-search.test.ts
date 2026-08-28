/**
 * ★ Cross-school isolation for the searchable audit log (spec §16.7, §22;
 * AT-08 material): a school `admin` must never be able to read another
 * school's fina_audit_log rows, and a `fina_supervisor` must never see
 * outside their own municipality — the same shape of leakage this session's
 * ★ tests have guarded against since Phase 0, now applied to the one screen
 * built specifically for regulators to audit compliance with.
 */
jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('./supervisor-access.service', () => ({ listMunicipalitySchoolIds: jest.fn() }))

import { supabase } from '../../config/supabase'
import { listMunicipalitySchoolIds } from './supervisor-access.service'
import { searchAuditLog } from './audit-search.service'
import { CallerContext } from './types'

const SCHOOL_A = 'school-a'
const SCHOOL_B = 'school-b'

function makeQueryBuilder(result: { data: any; error?: any }) {
  const builder: any = {}
  const calls: Record<string, any[]> = {}
  for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit']) {
    builder[method] = jest.fn((...args: any[]) => {
      calls[method] = args
      return builder
    })
  }
  builder.__calls = calls
  builder.then = (resolve: any) => resolve(result)
  return builder
}

describe('audit-search.service — searchAuditLog role scoping', () => {
  beforeEach(() => jest.clearAllMocks())

  it('admin is confined to their own school regardless of a requested schoolId', async () => {
    let seenBuilder: any
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => {
      seenBuilder = makeQueryBuilder({ data: [], error: null })
      return seenBuilder
    })
    const caller: CallerContext = { profileId: 'admin-1', role: 'admin', schoolId: SCHOOL_A }

    await searchAuditLog(caller, {})

    expect(seenBuilder.in).toHaveBeenCalledWith('school_id', [SCHOOL_A])
  })

  it('admin requesting another school explicitly is rejected, not silently redirected', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => makeQueryBuilder({ data: [], error: null }))
    const caller: CallerContext = { profileId: 'admin-1', role: 'admin', schoolId: SCHOOL_A }

    await expect(searchAuditLog(caller, { schoolId: SCHOOL_B })).rejects.toThrow('Access denied')
  })

  it('fina_supervisor is confined to their municipality\'s school list', async () => {
    ;(listMunicipalitySchoolIds as jest.Mock).mockResolvedValue([SCHOOL_A])
    let seenBuilder: any
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => {
      seenBuilder = makeQueryBuilder({ data: [], error: null })
      return seenBuilder
    })
    const caller: CallerContext = { profileId: 'sup-1', role: 'fina_supervisor', schoolId: 'org-parent' }

    await searchAuditLog(caller, {})

    expect(seenBuilder.in).toHaveBeenCalledWith('school_id', [SCHOOL_A])
  })

  it('fina_supervisor requesting a school outside their municipality is rejected', async () => {
    ;(listMunicipalitySchoolIds as jest.Mock).mockResolvedValue([SCHOOL_A])
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => makeQueryBuilder({ data: [], error: null }))
    const caller: CallerContext = { profileId: 'sup-1', role: 'fina_supervisor', schoolId: 'org-parent' }

    await expect(searchAuditLog(caller, { schoolId: SCHOOL_B })).rejects.toThrow('Access denied')
  })

  it('fina_supervisor with an empty municipality gets an empty result, never an unscoped query', async () => {
    ;(listMunicipalitySchoolIds as jest.Mock).mockResolvedValue([])
    const fromSpy = supabase.from as unknown as jest.Mock
    const caller: CallerContext = { profileId: 'sup-1', role: 'fina_supervisor', schoolId: 'org-parent' }

    const result = await searchAuditLog(caller, {})

    expect(result).toEqual([])
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('★ super_admin is denied outright — spec §12 gives SYSADMIN only "technical" audit access, not this human audit-log search', async () => {
    ;(supabase.from as unknown as jest.Mock).mockImplementation(() => makeQueryBuilder({ data: [], error: null }))
    const caller: CallerContext = { profileId: 'root-1', role: 'super_admin', schoolId: 'n/a' }

    await expect(searchAuditLog(caller, {})).rejects.toThrow('Access denied')
  })

  it('rejects a role with no defined audit access (e.g. teacher)', async () => {
    const caller: CallerContext = { profileId: 't-1', role: 'teacher', schoolId: SCHOOL_A }
    await expect(searchAuditLog(caller, {})).rejects.toThrow('Access denied')
  })
})
