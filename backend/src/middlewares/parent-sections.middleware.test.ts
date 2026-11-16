// Parents reach section-level data only for their ACTIVE linked children's sections; every other role passes.
const sections: { value: string[] | Error } = { value: [] }
jest.mock('../utils/parent-access', () => ({
  parentChildSectionIds: async () => {
    if (sections.value instanceof Error) throw sections.value
    return sections.value
  },
}))
const canView = jest.fn()
jest.mock('../utils/student-access', () => ({ canViewStudent: (...a: unknown[]) => canView(...a) }))
const rowSection: { value: string | null } = { value: null }
jest.mock('../config/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rowSection.value ? { section_id: rowSection.value } : null, error: null }) }) }) }) },
}))

import { parentOwnChild, parentOwnSectionQuery, parentOwnSectionRow } from './parent-sections.middleware'

function run(mw: any, req: any) {
  const res: any = { statusCode: 200, body: undefined }
  res.status = (c: number) => ((res.statusCode = c), res)
  res.json = (b: unknown) => ((res.body = b), res)
  const next = jest.fn()
  return mw({ params: {}, query: {}, ...req }, res, next).then(() => ({ res, next }))
}
const parent = { profile: { id: 'pp', role: 'parent' } }

beforeEach(() => {
  sections.value = ['secA']
  rowSection.value = null
  canView.mockReset()
})

describe('parentOwnSectionQuery', () => {
  it('passes other roles untouched', async () => {
    const { next } = await run(parentOwnSectionQuery(), { profile: { id: 't', role: 'teacher' }, query: { section_id: 'whatever' } })
    expect(next).toHaveBeenCalled()
  })
  it("refuses a section that is not one of the parent's children's", async () => {
    const { res, next } = await run(parentOwnSectionQuery(), { ...parent, query: { section_id: 'secB' } })
    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })
  it('allows an own section and forces the only one when none is given', async () => {
    expect((await run(parentOwnSectionQuery(), { ...parent, query: { section_id: 'secA' } })).next).toHaveBeenCalled()
    const req: any = { ...parent, query: {} }
    const { next } = await run(parentOwnSectionQuery(), req)
    expect(next).toHaveBeenCalled()
    expect(req.query.section_id).toBe('secA')
  })
  it('asks for a section when the children are in several, and refuses a parent with none', async () => {
    sections.value = ['secA', 'secB']
    expect((await run(parentOwnSectionQuery(), { ...parent })).res.statusCode).toBe(400)
    sections.value = []
    expect((await run(parentOwnSectionQuery(), { ...parent })).res.statusCode).toBe(403)
  })
  it('fails closed when the lookup breaks', async () => {
    sections.value = new Error('db down')
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const { res, next } = await run(parentOwnSectionQuery(), { ...parent, query: { section_id: 'secA' } })
    expect(res.statusCode).toBe(503)
    expect(next).not.toHaveBeenCalled()
  })
})

describe('parentOwnSectionRow', () => {
  it("404s a row of another section, allows the child's section, passes other roles", async () => {
    rowSection.value = 'secB'
    expect((await run(parentOwnSectionRow('class_diary_entries'), { ...parent, params: { id: 'e1' } })).res.statusCode).toBe(404)
    rowSection.value = 'secA'
    expect((await run(parentOwnSectionRow('class_diary_entries'), { ...parent, params: { id: 'e1' } })).next).toHaveBeenCalled()
    rowSection.value = 'secB'
    expect((await run(parentOwnSectionRow('learning_resources'), { profile: { id: 's', role: 'student' }, params: { id: 'r1' } })).next).toHaveBeenCalled()
  })
})

describe('parentOwnChild', () => {
  it('allows a linked child, refuses another student, passes other roles', async () => {
    canView.mockResolvedValue(true)
    expect((await run(parentOwnChild((r: any) => r.params.studentId), { ...parent, params: { studentId: 'st1' } })).next).toHaveBeenCalled()
    canView.mockResolvedValue(false)
    expect((await run(parentOwnChild((r: any) => r.params.studentId), { ...parent, params: { studentId: 'st9' } })).res.statusCode).toBe(403)
    expect((await run(parentOwnChild((r: any) => r.params.studentId), { profile: { id: 'a', role: 'admin' }, params: { studentId: 'st9' } })).next).toHaveBeenCalled()
  })
})
