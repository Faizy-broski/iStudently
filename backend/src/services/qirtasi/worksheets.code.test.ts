/** Worksheet codes (QRT-LY-…-EXnn) and the create handler's error path. Supabase is mocked. */
const state: { codes: string[]; conflicts: number; failWith: { code?: string; message: string } | null; removed: string[][] } = {
  codes: [],
  conflicts: 0,
  failWith: null,
  removed: [],
}

jest.mock('../../config/supabase', () => {
  const from = (table: string) => {
    let inserted: any = null
    let like: string | null = null
    const q: any = {
      select: () => q,
      eq: () => q,
      order: () => q,
      update: () => q,
      like: (_c: string, p: string) => ((like = p.replace(/%$/, '')), q),
      range: async (a: number, b: number) => ({ data: state.codes.filter((c) => c.startsWith(like!)).slice(a, b + 1).map((code) => ({ code })), error: null }),
      insert: (row: any) => ((inserted = row), q),
      single: async () => {
        if (table === 'qirtasi_grades') return { data: { code: 'KG' }, error: null }
        if (table === 'qirtasi_subjects') return { data: { code: 'EN' }, error: null }
        if (table === 'qirtasi_worksheet_versions') return { data: { id: 'v1' }, error: null }
        if (state.failWith) return { data: null, error: state.failWith }
        if (state.conflicts > 0 || state.codes.includes(inserted.code)) {
          state.conflicts--
          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "qirtasi_worksheets_code_key"' } }
        }
        state.codes.push(inserted.code)
        return { data: { id: 'w1', ...inserted }, error: null }
      },
      then: (resolve: any) => resolve({ data: [], error: null }),
    }
    return q
  }
  return { supabase: { from, storage: { from: () => ({ upload: async () => ({ error: null }), remove: async (p: string[]) => (state.removed.push(p), { error: null }) }) } } }
})
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async () => 'root' }))
jest.mock('./curriculum.service', () => ({
  CurriculumScopeError: class extends Error {},
  qirtasiCurriculumService: { assertWorksheetPlacement: async () => {} },
}))

import { qirtasiWorksheetsService } from './worksheets.service'
import { qirtasiWorksheetsController } from '../../controllers/qirtasi/worksheets.controller'

const input = { title_ar: 'ورقة', worksheet_type: 'quiz', grade_id: 'g', subject_id: 's' }
const create = () => qirtasiWorksheetsService.createWorksheet(input, 'school', 'owner', [])

beforeEach(() => {
  state.codes = []
  state.conflicts = 0
  state.failWith = null
  state.removed = []
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('worksheet codes', () => {
  it('numbers the second and third worksheet of a grade and subject', async () => {
    expect((await create()).code).toBe('QRT-LY-KG-EN-EX01')
    expect((await create()).code).toBe('QRT-LY-KG-EN-EX02')
    expect((await create()).code).toBe('QRT-LY-KG-EN-EX03')
  })
  it('continues from the highest number, as a number, past gaps and 99', async () => {
    state.codes = ['QRT-LY-KG-EN-EX02', 'QRT-LY-KG-EN-EX99', 'QRT-LY-KG-EN-EX100', 'QRT-LY-KG-EN-T1-EX500']
    expect((await create()).code).toBe('QRT-LY-KG-EN-EX101')
  })
  it('counts beyond one page of results (bulk uploads)', async () => {
    state.codes = Array.from({ length: 1500 }, (_, i) => `QRT-LY-KG-EN-EX${String(i + 1).padStart(2, '0')}`)
    expect((await create()).code).toBe('QRT-LY-KG-EN-EX1501')
  })
  it('takes another number when the code is taken at the same moment', async () => {
    state.conflicts = 2
    expect((await create()).code).toBe('QRT-LY-KG-EN-EX03')
  })
  it('gives up with a clear error instead of looping', async () => {
    state.conflicts = 100
    await expect(create()).rejects.toThrow(/Could not reserve a worksheet code for QRT-LY-KG-EN/)
  })
})

describe('POST /qirtasi/worksheets errors', () => {
  const call = async () => {
    const res: any = { status: jest.fn(() => res), json: jest.fn(() => res) }
    const req: any = {
      profile: { id: 'p', role: 'admin', school_id: 'school' },
      query: {},
      body: { ...input, grade_id: '11111111-1111-4111-8111-111111111111', subject_id: '22222222-2222-4222-8222-222222222222' },
      files: { file: [{ originalname: 'a.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('%PDF-1.4 test') }] },
    }
    const handler = qirtasiWorksheetsController.createWorksheet // unbound, as the router passes it
    await handler(req, res)
    return res
  }
  it('answers with the error (and removes the uploaded file) rather than hanging', async () => {
    state.failWith = { message: 'database is unhappy' }
    const res = await call()
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'database is unhappy' })
    expect(state.removed).toHaveLength(1)
  })
  it('answers 409 when no code can be reserved', async () => {
    state.conflicts = 100
    expect((await call()).status).toHaveBeenCalledWith(409)
  })
})
