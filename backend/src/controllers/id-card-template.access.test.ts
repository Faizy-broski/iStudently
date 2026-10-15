let row: any = null
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = { select: () => b, eq: () => b, maybeSingle: async () => ({ data: row }) }
      return b
    },
  },
}))
jest.mock('../utils/campus-validation', () => ({ campusIdsAllowed: jest.fn(async (own: string, ids: string[]) => ids.every((i) => i.startsWith(own))) }))
const generateTeacherIdCard = jest.fn(async () => ({ name: 'T' }))
const generateStaffIdCard = jest.fn(async () => ({ name: 'S' }))
jest.mock('../services/id-card-template.service', () => ({
  IdCardTemplateService: jest.fn().mockImplementation(() => ({ generateTeacherIdCard, generateStaffIdCard })),
  SUBSTITUTION_TOKENS: {},
}))
jest.mock('../services/setup-status.service', () => ({ setupStatusService: {} }))

import { IdCardTemplateController } from './id-card-template.controller'

const controller = new IdCardTemplateController()
function res() {
  const r: any = {}
  r.status = jest.fn(() => r)
  r.json = jest.fn(() => r)
  return r
}
const req = (profile: any, query: any) => ({ profile, query }) as any

beforeEach(() => jest.clearAllMocks())

describe('teacher/staff ID card access', () => {
  it('a student cannot generate a teacher card', async () => {
    row = { school_id: 'schoolA', profile_id: 'teacher-profile' }
    const r = res()
    await controller.generateTeacherIdCard(req({ id: 'stu', role: 'student', school_id: 'schoolA' }, { teacher_id: 't1' }), r)
    expect(r.status).toHaveBeenCalledWith(404)
    expect(generateTeacherIdCard).not.toHaveBeenCalled()
  })

  it("an admin cannot generate another school's staff card", async () => {
    row = { school_id: 'schoolB-campus', profile_id: 'x' }
    const r = res()
    await controller.generateStaffIdCard(req({ id: 'adm', role: 'admin', school_id: 'schoolA' }, { staff_id: 's1' }), r)
    expect(r.status).toHaveBeenCalledWith(404)
    expect(generateStaffIdCard).not.toHaveBeenCalled()
  })

  it('own-school admin, the person themselves and super admin can', async () => {
    row = { school_id: 'schoolA-branch', profile_id: 'teacher-profile' }
    for (const profile of [
      { id: 'adm', role: 'admin', school_id: 'schoolA' },
      { id: 'teacher-profile', role: 'teacher', school_id: 'schoolA' },
      { id: 'sa', role: 'super_admin', school_id: null },
    ]) {
      const r = res()
      await controller.generateTeacherIdCard(req(profile, { teacher_id: 't1' }), r)
      expect(r.json).toHaveBeenCalledWith({ idCard: { name: 'T' } })
    }
  })
})
