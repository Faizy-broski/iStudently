// Student assignment submission: only the student's own course periods, a graded submission is
// final, empty submissions are refused, and a resubmission keeps only files it really had.
const db: Record<string, (f: Record<string, unknown>) => unknown> = {}
const writes: { table: string; op: string; payload: any }[] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const f: Record<string, unknown> = {}
      let op = 'select'
      let payload: any
      const b: any = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => ((f[c] = v), b)
      b.in = (c: string, v: unknown) => ((f[c] = v), b)
      b.insert = (p: any) => ((op = 'insert'), (payload = p), b)
      b.update = (p: any) => ((op = 'update'), (payload = p), b)
      const run = async () => {
        if (op !== 'select') {
          writes.push({ table, op, payload })
          return { data: { id: 'new', ...payload }, error: null }
        }
        return { data: db[table]?.(f) ?? null, error: null }
      }
      b.maybeSingle = run
      b.single = run
      return b
    },
  },
}))

import { StudentDashboardService, SubmissionError } from './student-dashboard.service'

const svc = new StudentDashboardService()
const prior = [{ url: 'https://x/a.pdf', name: 'a.pdf' }, { url: 'https://x/b.pdf', name: 'b.pdf' }]

beforeEach(() => {
  writes.length = 0
  jest.spyOn(StudentDashboardService.prototype as any, 'resolveStudentCoursePeriodIds').mockResolvedValue(['cp1'])
  db.students = () => ({ section_id: 'sec1', school_id: 's1' })
  db.gradebook_assignments = (f) => (f.id === 'a1' ? { id: 'a1', course_period_id: 'cp1', is_active: true, enable_submission: true } : f.id === 'aX' ? { id: 'aX', course_period_id: 'cpOTHER', is_active: true } : null)
  db.student_assignments = () => null
  db.gradebook_grades = () => null
})

async function status(p: Promise<unknown>) {
  try {
    await p
    return 200
  } catch (e) {
    return e instanceof SubmissionError ? e.status : 500
  }
}

it('refuses an assignment outside the student\'s course periods (404)', async () => {
  expect(await status(svc.submitGradebookAssignment('stu1', 'aX', { submission_text: 'hi' }))).toBe(404)
  expect(writes).toHaveLength(0)
})

it('refuses a graded submission (409)', async () => {
  db.gradebook_grades = () => ({ id: 'g1' })
  expect(await status(svc.submitGradebookAssignment('stu1', 'a1', { submission_text: 'hi' }))).toBe(409)
  expect(writes).toHaveLength(0)
})

it('refuses an empty submission (400)', async () => {
  expect(await status(svc.submitGradebookAssignment('stu1', 'a1', { submission_text: '   ', attachments: [] }))).toBe(400)
})

it('keeps only earlier files that were really on the submission', async () => {
  db.student_assignments = () => ({ id: 'sub1', attachments: prior, status: 'submitted' })
  const fresh = { url: 'https://x/c.pdf', name: 'c.pdf' }
  await svc.submitGradebookAssignment('stu1', 'a1', {
    attachments: [fresh],
    existing_attachments: [prior[0], { url: 'https://evil/forged.pdf' }],
  })
  expect(writes[0].op).toBe('update')
  expect(writes[0].payload.attachments).toEqual([prior[0], fresh])
})
