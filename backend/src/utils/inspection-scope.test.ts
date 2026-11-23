let teacherRows: any[] = []
let subjectRows: any[] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: any = {}
      b.select = () => b
      b.in = () => b
      b.eq = () => b
      b.then = (resolve: any) => resolve({ data: table === 'profiles' ? teacherRows : subjectRows, error: null })
      return b
    },
  },
}))

import { assertMaxLength, assertTeachersAndSubjectsInSchool } from './inspection-scope'

it('accepts teachers and subjects that all belong to the campus', async () => {
  teacherRows = [{ id: 't1' }, { id: 't2' }]; subjectRows = [{ id: 's1' }]
  await expect(assertTeachersAndSubjectsInSchool('school', ['t1', 't2', 't1'], ['s1', null])).resolves.toBeUndefined()
})
it('rejects a teacher from another campus', async () => {
  teacherRows = [{ id: 't1' }]; subjectRows = []
  await expect(assertTeachersAndSubjectsInSchool('school', ['t1', 'stranger'])).rejects.toThrow(/teacher/i)
})
it('rejects a subject from another campus', async () => {
  teacherRows = [{ id: 't1' }]; subjectRows = []
  await expect(assertTeachersAndSubjectsInSchool('school', ['t1'], ['foreign-subject'])).rejects.toThrow(/subject/i)
})
it('caps free text length', () => {
  expect(() => assertMaxLength('x'.repeat(10), 5, 'body')).toThrow(/too long/)
  expect(() => assertMaxLength('x', 5, 'body')).not.toThrow()
  expect(() => assertMaxLength(undefined, 5, 'body')).not.toThrow()
})
