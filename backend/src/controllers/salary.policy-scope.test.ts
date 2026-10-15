// Policy-group handlers that take a group id from the URL must stay inside the caller's school family.
const groups: Record<string, { school_id: string }> = { 'g-own': { school_id: 'school-a' }, 'g-other': { school_id: 'school-b' } }
const staffRows: Record<string, { id: string; school_id: string }> = { 's-own': { id: 's-own', school_id: 'campus-a1' }, 's-other': { id: 's-other', school_id: 'school-b' } }

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, id: string) => ({ maybeSingle: async () => ({ data: table === 'salary_policy_groups' ? groups[id] ?? null : null, error: null }) }),
        in: async (_col: string, ids: string[]) => ({ data: ids.map((i) => staffRows[i]).filter(Boolean), error: null }),
      }),
    }),
  },
}))
// school-a and campus-a1 are one family; school-b is another school.
jest.mock('../utils/campus-validation', () => ({
  campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((i) => i === 'school-a' || i === 'campus-a1'),
}))
const service = {
  getPolicyGroupWithTeachers: jest.fn(async () => ({ id: 'g' })),
  removeTeacherFromPolicy: jest.fn(async () => undefined),
  assignTeachersToPolicy: jest.fn(async () => undefined),
  processAdvanceRequest: jest.fn(async () => ({})),
}
jest.mock('../services/salary.service', () => ({ salaryService: service }))

import { salaryController } from './salary.controller'

function call(handler: (req: any, res: any) => Promise<unknown>, req: object, role = 'admin') {
  const out: { status: number; body?: any } = { status: 200 }
  const res: any = {
    status: (s: number) => ((out.status = s), res),
    json: (b: unknown) => ((out.body = b), res),
  }
  return handler({ params: {}, query: {}, body: {}, profile: { id: 'admin-1', role, school_id: 'school-a' }, ...req }, res).then(() => out)
}

beforeEach(() => Object.values(service).forEach((f) => f.mockClear()))

describe('salary policy groups', () => {
  it('reads a group of the own school', async () => {
    expect((await call(salaryController.getPolicyGroupWithTeachers, { params: { id: 'g-own' } })).status).toBe(200)
  })

  it('hides another school’s group (read, remove, assign)', async () => {
    expect((await call(salaryController.getPolicyGroupWithTeachers, { params: { id: 'g-other' } })).status).toBe(404)
    expect((await call(salaryController.removeTeacherFromPolicy, { params: { id: 'g-other', staffId: 's-own' } })).status).toBe(404)
    expect((await call(salaryController.assignTeachersToPolicy, { params: { id: 'g-other' }, body: { school_id: 'school-a', staff_ids: ['s-own'] } })).status).toBe(404)
    expect(service.getPolicyGroupWithTeachers).not.toHaveBeenCalled()
    expect(service.removeTeacherFromPolicy).not.toHaveBeenCalled()
    expect(service.assignTeachersToPolicy).not.toHaveBeenCalled()
  })

  it('refuses to assign staff from another school or unknown staff', async () => {
    const body = (ids: string[]) => ({ params: { id: 'g-own' }, body: { school_id: 'school-a', staff_ids: ids } })
    expect((await call(salaryController.assignTeachersToPolicy, body(['s-own', 's-other']))).status).toBe(403)
    expect((await call(salaryController.assignTeachersToPolicy, body(['s-missing']))).status).toBe(403)
    expect(service.assignTeachersToPolicy).not.toHaveBeenCalled()
    expect((await call(salaryController.assignTeachersToPolicy, body(['s-own']))).status).toBe(200)
  })

  it('super admin may open any group', async () => {
    expect((await call(salaryController.getPolicyGroupWithTeachers, { params: { id: 'g-other' } }, 'super_admin')).status).toBe(200)
  })
})

describe('advances', () => {
  it('records the signed-in user as the approver, not an id from the body', async () => {
    await call(salaryController.processAdvance, { params: { id: 'adv-1' }, body: { school_id: 'school-a', action: 'approve', admin_id: 'someone-else' } })
    expect(service.processAdvanceRequest).toHaveBeenCalledWith('adv-1', 'school-a', 'approve', 'admin-1', undefined, undefined)
  })
})
