jest.mock('../config/supabase', () => ({ supabase: {} }))
jest.mock('./auth.middleware', () => ({ authenticate: (_q: any, _r: any, n: any) => n() }))
jest.mock('../services/module-access.service', () => ({ decideStaffModuleAccess: () => ({ allowed: false }), loadProfilePermissions: async () => ({}) }))
jest.mock('../services/teacher-sections', () => ({ teacherSectionIds: async () => [] }), { virtual: true })
import { librarianOwnCampus } from '../routes/student.routes'

const run = (profile: any, query: any) => {
  const req: any = { profile, query }
  librarianOwnCampus(req, {} as any, () => {})
  return req.query
}

describe('librarianOwnCampus', () => {
  it('replaces any campus_id a librarian sends with their own', () => {
    expect(run({ role: 'librarian', campus_id: 'mine', school_id: 'root' }, { campus_id: 'other' }).campus_id).toBe('mine')
    expect(run({ role: 'librarian', school_id: 'root' }, {}).campus_id).toBe('root')
  })
  it('leaves other roles alone', () => {
    expect(run({ role: 'admin', school_id: 'root' }, { campus_id: 'other' }).campus_id).toBe('other')
  })
})
