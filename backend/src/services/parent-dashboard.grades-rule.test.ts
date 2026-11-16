// Grade visibility rule for parents: results appear once marks are ENTERED (marks_obtained not null),
// exactly like the student dashboard and the web; no exams.is_published gate on results.
const calls: Array<[string, string, unknown?]> = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const b: any = {}
      for (const m of ['select', 'in', 'order', 'limit', 'gte', 'lte']) b[m] = () => b
      b.eq = (c: string, v: unknown) => (calls.push([table, `eq:${c}`, v]), b)
      b.not = (c: string, op: string, v: unknown) => (calls.push([table, `not:${c}:${op}`, v]), b)
      b.single = async () => ({ data: { section_id: 'sec', school_id: 'sch' }, error: null })
      b.then = (resolve: any) => resolve({ data: [], error: null })
      return b
    },
  },
}))

import { parentDashboardService } from './parent-dashboard.service'

beforeEach(() => (calls.length = 0))

describe('parent grade endpoints', () => {
  it('recent grades and final grades require marks entered, with no is_published gate', async () => {
    await parentDashboardService.getRecentGrades('st1', 5)
    await parentDashboardService.getFinalGrades('st1')
    expect(calls).toContainEqual(['exam_results', 'not:marks_obtained:is', null])
    expect(calls.filter((c) => c[1] === 'eq:is_published' && c[0] === 'exam_results')).toHaveLength(0)
    expect(calls.filter((c) => c[1] === 'eq:is_published' && c[0] === 'exams')).toHaveLength(0)
  })
  it('only the upcoming-exams announcement is gated on is_published', async () => {
    await parentDashboardService.getUpcomingExams('st1', 3)
    expect(calls).toContainEqual(['exams', 'eq:is_published', true])
  })
})
