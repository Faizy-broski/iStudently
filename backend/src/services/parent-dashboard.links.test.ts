// A parent's child list must only include actively linked children.
const eqCalls: Array<[string, unknown]> = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => { eqCalls.push([c, v]); return b }
      b.then = (resolve: any) => resolve({ data: [], error: null })
      return b
    },
  },
}))

import * as mod from './parent-dashboard.service'

it('getStudentsList filters parent_student_links on is_active', async () => {
  const svc: any = (mod as any).parentDashboardService ?? new (mod as any).ParentDashboardService()
  await svc.getStudentsList('parent-1')
  expect(eqCalls).toContainEqual(['parent_id', 'parent-1'])
  expect(eqCalls).toContainEqual(['is_active', true])
})
