// schools: main-a (root) with branches a1, a2; main-b (root) with branch b1.
const SCHOOLS: Record<string, string | null> = {
  '00000000-0000-4000-8000-00000000000a': null, // main-a
  '00000000-0000-4000-8000-0000000000a1': '00000000-0000-4000-8000-00000000000a',
  '00000000-0000-4000-8000-0000000000a2': '00000000-0000-4000-8000-00000000000a',
  '00000000-0000-4000-8000-00000000000b': null, // main-b
  '00000000-0000-4000-8000-0000000000b1': '00000000-0000-4000-8000-00000000000b',
}
let lookups = 0
jest.mock('../config/supabase', () => ({
  supabase: {
    from: () => {
      let id = ''
      const b: any = {
        select: () => b,
        eq: (_c: string, v: string) => ((id = v), b),
        maybeSingle: async () => {
          lookups++
          return id in SCHOOLS ? { data: { id, parent_school_id: SCHOOLS[id] }, error: null } : { data: null, error: null }
        },
      }
      return b
    },
  },
}))

import { campusIdsAllowed, requestedCampusIds } from './campus-validation'

const A = '00000000-0000-4000-8000-00000000000a'
const A1 = '00000000-0000-4000-8000-0000000000a1'
const A2 = '00000000-0000-4000-8000-0000000000a2'
const B1 = '00000000-0000-4000-8000-0000000000b1'
const MISSING = '00000000-0000-4000-8000-0000000000ff'

describe('requestedCampusIds', () => {
  it('reads UUID campus_id from query (string or array) and body; ignores other values', () => {
    expect(requestedCampusIds({ campus_id: A1 }, undefined)).toEqual([A1])
    expect(requestedCampusIds({ campus_id: [A1, A2] }, { campus_id: A1 })).toEqual([A1, A2])
    expect(requestedCampusIds({ campus_id: 'all' }, { campus_id: '' })).toEqual([])
    expect(requestedCampusIds({}, [{ campus_id: A1 }])).toEqual([])
    expect(requestedCampusIds({ school_id: B1 }, { school_id: A2 })).toEqual([B1, A2])
    expect(requestedCampusIds({}, { campusId: B1, schoolId: A1 })).toEqual([B1, A1])
  })
})

describe('campusIdsAllowed', () => {
  it('allows the own school, its branches and sibling branches', async () => {
    expect(await campusIdsAllowed(A, [A1, A2, A])).toBe(true)
    expect(await campusIdsAllowed(A1, [A2])).toBe(true) // e.g. a parent with children at two branches
    expect(await campusIdsAllowed(A1, [])).toBe(true)
  })

  it("refuses another school's campus and unknown ids", async () => {
    expect(await campusIdsAllowed(A, [B1])).toBe(false)
    expect(await campusIdsAllowed(A, [A1, B1])).toBe(false)
    expect(await campusIdsAllowed(A, [MISSING])).toBe(false)
    expect(await campusIdsAllowed(null, [A1])).toBe(false)
  })

  it('caches school roots', async () => {
    const before = lookups
    await campusIdsAllowed(A, [A1])
    expect(lookups).toBe(before)
  })
})
