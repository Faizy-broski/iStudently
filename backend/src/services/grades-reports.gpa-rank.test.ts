// GPA / class rank list from final grades (web /admin/grades/class-ranks).
const rows = [
  // Ana: A (4.0, 4 credits) + B (3.0, 1 credit) -> unweighted 3.5, weighted 3.8
  { student_id: 'ana', gpa_value: 4, credit_attempted: 4, course_period: { affects_class_rank: true }, student: { student_number: 'S1', profile: { first_name: 'Ana', last_name: 'A' }, grade_level: { name: 'G1' } } },
  { student_id: 'ana', gpa_value: 3, credit_attempted: 1, course_period: { affects_class_rank: true }, student: { student_number: 'S1', profile: { first_name: 'Ana', last_name: 'A' }, grade_level: { name: 'G1' } } },
  // Ben: 3.8 -> ties with Ana on weighted GPA
  { student_id: 'ben', gpa_value: 3.8, credit_attempted: 2, course_period: { affects_class_rank: true }, student: { student_number: 'S2', profile: { first_name: 'Ben', last_name: 'B' }, grade_level: { name: 'G1' } } },
  // Cy: 2.0 counts; the 4.0 course does not affect class rank
  { student_id: 'cy', gpa_value: 2, credit_attempted: null, course_period: { affects_class_rank: true }, student: { student_number: 'S3', profile: { first_name: 'Cy', last_name: 'C' }, grade_level: { name: 'G1' } } },
  { student_id: 'cy', gpa_value: 4, credit_attempted: 1, course_period: { affects_class_rank: false }, student: { student_number: 'S3', profile: { first_name: 'Cy', last_name: 'C' }, grade_level: { name: 'G1' } } },
]
const filters: [string, string][] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const q: any = {
        select: () => q,
        eq: (c: string, v: string) => (filters.push([c, v]), q),
        not: () => q,
        then: (resolve: any) => resolve({ data: rows, error: null }),
      }
      return q
    },
  },
}))
jest.mock('./final-grades.service', () => ({ finalGradesService: {} }))

import { gradesReportsService } from './grades-reports.service'

describe('getGpaRankList', () => {
  it('computes unweighted / credit-weighted GPA, skips non-ranking courses, shares tied ranks', async () => {
    const list = await gradesReportsService.getGpaRankList('school-a', 'mp-1', { campus_id: 'campus-a1' })
    expect(list.map((x) => [x.student_name, x.unweighted_gpa, x.weighted_gpa, x.class_rank])).toEqual([
      ['Ana A', 3.5, 3.8, 1],
      ['Ben B', 3.8, 3.8, 1],
      ['Cy C', 2, 2, 3],
    ])
    expect(filters).toEqual(expect.arrayContaining([['school_id', 'school-a'], ['marking_period_id', 'mp-1'], ['campus_id', 'campus-a1']]))
  })

  it('search narrows the list but keeps ranks of the whole group', async () => {
    const list = await gradesReportsService.getGpaRankList('school-a', 'mp-1', { search: 'cy' })
    expect(list).toHaveLength(1)
    expect(list[0].class_rank).toBe(3)
  })
})
