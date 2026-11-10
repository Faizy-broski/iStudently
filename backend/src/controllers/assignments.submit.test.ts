// POST /assignments/submit: the student id comes from the token, and only an assignment of the
// student's own section can be submitted.
const rows: Record<string, Record<string, any>> = {
  students: { 'stu-1': { section_id: 'sec1' } },
  assignments: { a1: { section_id: 'sec1' }, aX: { section_id: 'secOTHER' } },
}
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let id = ''
      const b: any = {}
      b.select = () => b
      b.eq = (_c: string, v: string) => ((id = v), b)
      b.maybeSingle = async () => ({ data: rows[table]?.[id] ?? null, error: null })
      return b
    },
  },
}))
jest.mock('../services/assignments.service', () => ({ submitAssignment: jest.fn(async () => ({ success: true, data: {} })) }))

import * as svc from '../services/assignments.service'
import { submitAssignment } from './assignments.controller'

function mockRes() {
  const res: any = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}
const student = { id: 'p-stu', role: 'student', student_id: 'stu-1' }

beforeEach(() => jest.clearAllMocks())

it('submits as the signed-in student even if the body names another', async () => {
  await submitAssignment({ profile: student, body: { assignment_id: 'a1', student_id: 'stu-OTHER' } } as any, mockRes())
  expect(svc.submitAssignment).toHaveBeenCalledWith(expect.objectContaining({ student_id: 'stu-1' }))
})

it('rejects an assignment of another section', async () => {
  const res = mockRes()
  await submitAssignment({ profile: student, body: { assignment_id: 'aX' } } as any, res)
  expect(res.status).toHaveBeenCalledWith(404)
  expect(svc.submitAssignment).not.toHaveBeenCalled()
})

it('rejects callers without a student record', async () => {
  const res = mockRes()
  await submitAssignment({ profile: { id: 'p-t', role: 'teacher' }, body: { assignment_id: 'a1', student_id: 'stu-1' } } as any, res)
  expect(res.status).toHaveBeenCalledWith(403)
})
