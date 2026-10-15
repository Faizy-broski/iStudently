// schools: main-a with branch a1; main-b. Rows: r-a1 in a1, r-b in main-b, ex-a1 (embedded parent in a1).
const A = '00000000-0000-4000-8000-00000000000a'
const A1 = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-00000000000b'
const SCHOOLS: Record<string, string | null> = { [A]: null, [A1]: A, [B]: null }
const ROWS: Record<string, Record<string, any>> = {
  'r-a1': { school_id: A1 },
  'r-b': { school_id: B },
  'ex-a1': { automatic_records: { school_id: A1 } },
}

jest.mock('../config/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let id = ''
      const b: any = {
        select: () => b,
        eq: (_c: string, v: string) => ((id = v), b),
        maybeSingle: async () => {
          if (table === 'schools') return { data: id in SCHOOLS ? { id, parent_school_id: SCHOOLS[id] } : null, error: null }
          return { data: ROWS[id] ?? null, error: null }
        },
      }
      return b
    },
  },
}))

import { requireRowInSchoolFamily } from './row-school-scope.middleware'

async function run(profile: any, id: string, select?: string) {
  const req: any = { profile, params: { id } }
  const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this }, json() { return this } }
  const next = jest.fn()
  await requireRowInSchoolFamily('t', 'id', select)(req, res, next)
  return { allowed: next.mock.calls.length === 1, status: res.statusCode }
}

describe('requireRowInSchoolFamily', () => {
  it('allows a row in a branch of the caller\'s school', async () => {
    expect((await run({ role: 'admin', school_id: A }, 'r-a1')).allowed).toBe(true)
  })
  it('hides another school\'s row as 404', async () => {
    expect(await run({ role: 'admin', school_id: A }, 'r-b')).toEqual({ allowed: false, status: 404 })
  })
  it('returns 404 for a missing row', async () => {
    expect(await run({ role: 'admin', school_id: A }, 'nope')).toEqual({ allowed: false, status: 404 })
  })
  it('reads school_id through an embedded parent', async () => {
    expect((await run({ role: 'admin', school_id: A }, 'ex-a1', 'automatic_records!inner(school_id)')).allowed).toBe(true)
    expect((await run({ role: 'admin', school_id: B }, 'ex-a1', 'automatic_records!inner(school_id)')).allowed).toBe(false)
  })
  it('reads the id from the query or body when asked', async () => {
    const res: any = { statusCode: 200, status(c: number) { this.statusCode = c; return this }, json() { return this } }
    const ok = jest.fn()
    await requireRowInSchoolFamily('t', 'year', 'school_id', 'query')({ profile: { role: 'admin', school_id: A }, params: {}, query: { year: 'r-a1' } } as any, res, ok)
    expect(ok).toHaveBeenCalledTimes(1)
    const blocked = jest.fn()
    await requireRowInSchoolFamily('t', 'year', 'school_id', 'body')({ profile: { role: 'admin', school_id: A }, params: {}, body: { year: 'r-b' } } as any, res, blocked)
    expect(blocked).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(404)
  })
  it('leaves a missing query/body id to the handler', async () => {
    const next = jest.fn()
    await requireRowInSchoolFamily('t', 'year', 'school_id', 'query')({ profile: { role: 'admin', school_id: A }, params: {}, query: {} } as any, {} as any, next)
    expect(next).toHaveBeenCalledTimes(1)
  })
  it('lets super admins through without a lookup', async () => {
    expect((await run({ role: 'super_admin', school_id: null }, 'r-b')).allowed).toBe(true)
  })
})
