// A hifzi_compliance-only grant must never open the general inspection module:
// the program filter defaults to 'general' for every general-inspection check.
const eqCalls: Array<[string, unknown]> = []
let rows: any[] = []
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      const b: any = {}
      b.select = () => b
      b.eq = (c: string, v: unknown) => { eqCalls.push([c, v]); return b }
      b.limit = () => b
      b.then = (resolve: any) => resolve({ data: rows, error: null })
      return b
    },
  },
}))

import { assertInspectorCanAccessSchool, listAssignedSchoolIds } from './inspector-access'

beforeEach(() => { eqCalls.length = 0; rows = [{ id: 'a', school_id: 's1' }] })

it('school access defaults to the general program', async () => {
  await assertInspectorCanAccessSchool('insp', 's1', 'inspector')
  expect(eqCalls).toContainEqual(['program', 'general'])
})
it('assigned school list defaults to the general program', async () => {
  await listAssignedSchoolIds('insp')
  expect(eqCalls).toContainEqual(['program', 'general'])
})
it('hifzi compliance asks for its own program explicitly', async () => {
  await listAssignedSchoolIds('insp', 'hifzi_compliance')
  expect(eqCalls).toContainEqual(['program', 'hifzi_compliance'])
})
it('super_admin always passes without a query', async () => {
  expect(await assertInspectorCanAccessSchool('x', 's1', 'super_admin')).toBe(true)
  expect(eqCalls).toHaveLength(0)
})
