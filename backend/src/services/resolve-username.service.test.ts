const calls: { op: string; args: any[] }[] = []
let result: { data: any; error: any } = { data: null, error: null }

jest.mock('../config/supabase', () => {
  const b: any = {}
  for (const op of ['select', 'ilike', 'eq', 'limit']) {
    b[op] = (...args: any[]) => {
      calls.push({ op, args })
      return b
    }
  }
  b.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return { supabase: { from: () => b } }
})

import { escapeLike, resolveUsernameEmail } from './resolve-username.service'

beforeEach(() => {
  calls.length = 0
  result = { data: null, error: null }
})

describe('escapeLike', () => {
  it('escapes %, _ and backslash', () => {
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d')
    expect(escapeLike('john.smith')).toBe('john.smith')
  })
})

describe('resolveUsernameEmail', () => {
  it('queries an escaped, trimmed pattern', async () => {
    result = { data: [{ email: 'a@x.test' }], error: null }
    await expect(resolveUsernameEmail('  ad%  ')).resolves.toBe('a@x.test')
    expect(calls.find((c) => c.op === 'ilike')?.args).toEqual(['username', 'ad\\%'])
  })

  it('returns null for no match, ambiguous matches, errors and bad input', async () => {
    result = { data: [], error: null }
    await expect(resolveUsernameEmail('nobody')).resolves.toBeNull()
    result = { data: [{ email: 'a@x.test' }, { email: 'b@x.test' }], error: null }
    await expect(resolveUsernameEmail('dup')).resolves.toBeNull()
    result = { data: null, error: { message: 'boom' } }
    await expect(resolveUsernameEmail('x')).resolves.toBeNull()
    calls.length = 0
    await expect(resolveUsernameEmail('   ')).resolves.toBeNull()
    await expect(resolveUsernameEmail('x'.repeat(101))).resolves.toBeNull()
    expect(calls).toEqual([])
  })
})
