// Real router + row-scope middleware + controller; auth, family check, Supabase and the service stubbed.
// Courses/course periods used to be readable and writable by id from any school, and updates took
// any body field (school_id included).
jest.mock('../middlewares/auth.middleware', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const role = req.headers['x-test-role']
    if (role) req.profile = { id: 'p1', role, school_id: 's1' }
    next()
  },
}))
jest.mock('../services/module-access.service', () => ({
  decideStaffModuleAccess: () => ({ allowed: false }),
  loadProfilePermissions: async () => ({}),
}))
jest.mock('../utils/campus-validation', () => ({
  campusIdsAllowed: async (_own: string, ids: string[]) => ids.every((id) => id === 's1' || id === 'c1'),
}))
const rows: Record<string, any> = {}
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = {}
      let ids: string[] = []
      b.select = () => b
      b.eq = (_c: string, v: string) => ((ids = [v]), b)
      b.in = (_c: string, v: string[]) => ((ids = v), b)
      b.maybeSingle = async () => ({ data: rows[ids[0]] ?? null, error: null })
      b.then = (resolve: any) => resolve({ data: ids.filter((i) => rows[i]).map((i) => ({ id: i, ...rows[i] })), error: null })
      return b
    },
  },
}))
const service = {
  getCourseById: jest.fn(async (id: string) => ({ id })),
  updateCourse: jest.fn(async (id: string, dto: any) => ({ id, ...dto })),
  deleteCourse: jest.fn(async () => undefined),
  getCoursePeriods: jest.fn(async () => []),
  updateCoursePeriod: jest.fn(async (id: string, dto: any) => ({ id, ...dto })),
  createCoursePeriod: jest.fn(async () => ({ id: 'new' })),
  getCoursePeriodsByStudent: jest.fn(async () => []),
}
jest.mock('../services/courses.service', () => ({ coursesService: service }))

import express from 'express'
import type { AddressInfo } from 'net'
import router from './courses.routes'

let base = ''
let server: any
beforeAll((done) => {
  const app = express()
  app.use(express.json())
  app.use('/api/courses', router)
  server = app.listen(0, () => {
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/courses`
    done()
  })
})
afterAll(() => {
  server.close()
})
beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  jest.clearAllMocks()
  rows['own'] = { school_id: 'c1' }
  rows['foreign'] = { school_id: 's9' }
  rows['cp-own'] = { school_id: 's1' }
  rows['cp-foreign'] = { school_id: 's9' }
  rows['t-own'] = { school_id: 'c1' }
  rows['t-foreign'] = { school_id: 's9' }
})

const call = (method: string, path: string, body?: unknown, role = 'admin') =>
  fetch(`${base}${path}`, { method, headers: { 'x-test-role': role, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('courses routes', () => {
  it("hides another school's course and course periods", async () => {
    expect((await call('GET', '/foreign')).status).toBe(404)
    expect((await call('PUT', '/foreign', { title: 'x' })).status).toBe(404)
    expect((await call('DELETE', '/foreign')).status).toBe(404)
    expect((await call('GET', '/foreign/periods', undefined, 'teacher')).status).toBe(404)
    expect((await call('PUT', '/own/periods/cp-foreign', {})).status).toBe(404)
    expect((await call('GET', '/student/foreign', undefined, 'student')).status).toBe(404)
    expect(service.updateCourse).not.toHaveBeenCalled()
    expect(service.deleteCourse).not.toHaveBeenCalled()
    expect(service.updateCoursePeriod).not.toHaveBeenCalled()
  })

  it('drops protected fields from updates', async () => {
    expect((await call('PUT', '/own', { title: 'Math', school_id: 's9', id: 'zzz' })).status).toBe(200)
    expect(service.updateCourse).toHaveBeenCalledWith('own', { title: 'Math' })
  })

  it("rejects a teacher from another school on a course period", async () => {
    expect((await call('PUT', '/own/periods/cp-own', { teacher_id: 't-foreign' })).status).toBe(400)
    expect((await call('POST', '/own/periods', { teacher_id: 't-foreign' })).status).toBe(400)
    expect((await call('PUT', '/own/periods/cp-own', { teacher_id: 't-own', room: 'A1' })).status).toBe(200)
    expect(service.updateCoursePeriod).toHaveBeenCalledWith('cp-own', { teacher_id: 't-own', room: 'A1' })
  })
})
