jest.mock('../config/supabase', () => ({ supabase: {} }))
import { withDisciplineFieldNames } from './student-dashboard.service'

describe('withDisciplineFieldNames', () => {
  it('names only the fields each referral uses', () => {
    const out = withDisciplineFieldNames(
      [{ id: 'r1', field_values: { f1: 'Y', f2: 'x' } }, { id: 'r2', field_values: null }],
      [{ id: 'f1', name: 'Fighting' }, { id: 'f3', name: 'Other' }],
    )
    expect(out[0].field_names).toEqual({ f1: 'Fighting' })
    expect(out[1].field_names).toEqual({})
  })
})
