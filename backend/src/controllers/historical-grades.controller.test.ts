// GPA per past marking period and cumulative GPA (oldest period first).
const tables: Record<string, any[]> = {}
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (t: string) => {
      const b: any = {}
      b.select = () => b
      b.eq = () => b
      b.then = (resolve: any) => resolve({ data: tables[t] ?? [], error: null })
      return b
    },
  },
}))

import { listStudentMarkingPeriods } from './historical-grades.controller'

it('averages grade points per period and cumulatively, unweighted falling back to gp_scale', async () => {
  tables.student_history_marking_periods = [
    { grade_level: '10', mp: { id: 'b', name: 'Q2', post_end_date: '2023-01-20', school_year: '2022-2023' } },
    { grade_level: '10', mp: { id: 'a', name: 'Q1', post_end_date: '2022-11-01', school_year: '2022-2023' } },
  ]
  tables.historical_grades = [
    { marking_period_id: 'a', gp_scale: 4, unweighted_gp: 3.5 },
    { marking_period_id: 'a', gp_scale: 3, unweighted_gp: null },
    { marking_period_id: 'a', gp_scale: null, unweighted_gp: null },
    { marking_period_id: 'b', gp_scale: 2, unweighted_gp: 2 },
  ]
  const res: any = { json: jest.fn(), status: jest.fn(() => res) }
  await listStudentMarkingPeriods({ params: { studentId: 's' } } as any, res)
  const data = res.json.mock.calls[0][0].data
  expect(data.map((m: any) => m.mp_id)).toEqual(['a', 'b'])
  expect(data[0]).toMatchObject({ weighted_gpa: 3.5, unweighted_gpa: 3.25, weighted_cum: 3.5, grade_level: '10', posted: '2022-11-01' })
  expect(data[1]).toMatchObject({ weighted_gpa: 2, weighted_cum: 3, unweighted_cum: 2.83 })
})
