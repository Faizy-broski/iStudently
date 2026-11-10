// Jahbadh Wave 5 (insight and administration) on the client's sample classes (brief B6-30 … B6-50, B6-62).
jest.mock('../../../config/supabase', () => require('../jg-test-db').supabaseMock)
jest.mock('../../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../../utils/html-pdf.util', () => ({
  escapeHtml: (x: string) => String(x).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
  renderHtmlToPdf: async () => Buffer.from(''),
}))
jest.mock('../../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn(async () => undefined) } }))

import { classBoard, subjectOverview } from '../../../lib/jahbadh'
import { db, resetDb } from '../jg-test-db'
import { loadFixture } from '../jg-test-fixtures'
import type { JgPrintHeader } from '../print.service'
import * as ins from './insight.service'
import { computedClass, infographicModel, parseInfScope } from './model'
import * as pr from './print-insight.service'

const header: JgPrintHeader = { schoolName: 'مدرسة الناجحون', logoUrl: null, educationOffice: 'طرابلس', municipality: 'طرابلس', principal: 'المدير', homeroomTeacher: 'رائد' }
const admin = { profileId: 'p-admin', role: 'admin' }

beforeEach(() => resetDb())

describe('class model and infographics (grade 13)', () => {
  it('builds the class from the section computation', async () => {
    const ctx = loadFixture(13)
    const { cls } = await computedClass(ctx)
    expect(cls.students).toHaveLength(db.students.length)
    expect(cls.subjects.length).toBe(ctx.grade.subjects.length)
    expect(cls.students.filter((s) => s.rankable).every((s) => s.rank !== null)).toBe(true)
  })

  it('serves period-scoped models the shared reports read', async () => {
    const ctx = loadFixture(13)
    const fin = await infographicModel(ctx, { kind: 'final' })
    expect(fin.classResults).toHaveLength(db.students.length)
    expect(subjectOverview(fin, fin.subjects[0].id)?.summary.length).toBeGreaterThan(2)
    expect(classBoard(fin)?.kinds).toBeDefined()
    const toDate = await infographicModel(ctx, parseInfScope(ctx, 'todate'))
    expect(toDate.subjects[0].measures[0].pctScale).toBe(true)
    const st1 = await infographicModel(ctx, parseInfScope(ctx, 'stage:1'))
    expect(st1.subjects.every((s) => s.measures[0].kind === 'stage')).toBe(true)
    expect(() => parseInfScope(ctx, 'stage:9')).toThrow()
    const res = await ins.infographics(ctx, 'stage:1', 'final')
    expect(res.compare?.scope.kind).toBe('final')
    expect(res.scopes.some((s) => s.value === 'final')).toBe(true)
  })
})

describe('insight pages (grade 13)', () => {
  it('prediction, edge, inflation, comments, weak items, absence, progress, end of year compute and print', async () => {
    const ctx = loadFixture(13)
    const p = await ins.getPrediction(ctx)
    expect(p.rows).toHaveLength(db.students.length)
    expect(pr.predictionHtml(p, header)).toContain('التوقع المبكر')
    const one = await ins.getPrediction(ctx, 'st1')
    expect(pr.predictionHtml(one, header)).toContain('للنجاح')
    expect(pr.edgeHtml(await ins.getEdge(ctx), header)).toContain('الطلاب على الحافة')
    expect(pr.inflationHtml(await ins.getInflation(ctx), header)).toContain('مؤشر تضخم الأعمال')
    expect(pr.autoCommentsHtml(await ins.getAutoComments(ctx, 1), header)).toContain('الملاحظات التلقائية')
    await expect(ins.getAutoComments(ctx, 9)).rejects.toThrow()
    const subj = ctx.grade.subjects.find((s) => s.components.some((c) => c.subitems.length))
    if (subj) expect(pr.weakItemsHtml(await ins.getWeakItems(ctx, subj.id, subj.components.find((c) => c.subitems.length)!.stage), header)).toContain('خريطة البنود')
    expect(pr.absenceImpactHtml(await ins.getAbsenceImpact(ctx), header)).toContain('أثر الغياب')
    const prog = await ins.getEntryProgress(ctx)
    expect(prog.rows.length).toBeGreaterThan(0)
    expect(pr.entryProgressHtml(prog, header)).toContain('متابعة الرصد')
    const eoy = await ins.getEndOfYear(ctx)
    expect(eoy.totals.enrolled.total).toBe(db.students.length)
    expect(pr.endOfYearHtml(eoy, header)).toContain('التقرير الختامي')
  })

  it('what-if never writes grades and saves named scenarios', async () => {
    const ctx = loadFixture(13)
    const marksBefore = JSON.stringify(db.jg_marks)
    const r = await ins.runWhatIf(ctx, { totalMin: 0.6 })
    expect(r.after.pass).toBeLessThanOrEqual(r.now.pass)
    expect(JSON.stringify(db.jg_marks)).toBe(marksBefore)
    await expect(ins.runWhatIf(ctx, { totalMin: 2 })).rejects.toThrow()
    const list = await ins.saveScenario(ctx, null, { name: 'حد 60%', params: { totalMin: 0.6 } }, admin)
    expect(list).toHaveLength(1)
    expect(pr.whatIfHtml(r, header)).toContain('محاكي ماذا لو')
  })

  it('the auditor blocks publishing while errors exist (incomplete sample slots)', async () => {
    const ctx = loadFixture(13)
    const a = await ins.getAudit(ctx)
    expect(a.errors).toBeGreaterThan(0)
    await expect(ins.assertPublishable(ctx)).rejects.toMatchObject({ status: 409, code: 'audit_errors' })
    expect(pr.auditHtml(a, header)).toContain('مدقق الإدخال')
  })
})

describe('approval, verification, certificates, plans, points (grade 3)', () => {
  /** Grade 3 sample without the incomplete slots, so the auditor passes and approval works. */
  async function cleanCtx() {
    const ctx = loadFixture(3)
    const { cls } = await computedClass(ctx)
    const a = await ins.getAudit(ctx)
    const bad = new Set(a.issues.filter((i) => i.level === 'error').map((i) => i.student_id))
    db.students = db.students.filter((s) => !bad.has(s.id))
    expect(cls.students.length).toBeGreaterThan(db.students.length - 1)
    return ctx
  }

  it('approval snapshot matches, then lists a later change', async () => {
    const ctx = await cleanCtx()
    const after = await ins.approve(ctx, 'اعتماد الفترة الأولى', admin)
    expect(after.status).toBe('matches')
    const sid = db.students[0].id
    const mark = db.jg_marks.find((m) => m.student_id === sid && m.value !== null) ?? db.jg_monthly_marks.find((m) => m.student_id === sid && m.value !== null)!
    mark.value = Number(mark.value) === 0 ? 1 : 0
    const changed = await ins.getApproval(ctx)
    expect(changed.status).toBe('changed')
    expect(changed.changes.length).toBeGreaterThan(0)
    expect(pr.approvalHtml(changed, header)).toContain('سجل الاعتماد')
  })

  it('verification codes stay for unchanged cards and read outdated after a change', async () => {
    const ctx = loadFixture(3)
    const codes = await ins.issueCodes(ctx, 'final', admin)
    const sid = db.students[0].id
    expect(codes[sid]).toMatch(/^\d{10}$/)
    expect((await ins.issueCodes(ctx, 'final', admin))[sid]).toBe(codes[sid])
    expect((await ins.checkCode(ctx, codes[sid])).status).toBe('matches')
    const mark = db.jg_marks.find((m) => m.student_id === sid && m.value !== null) ?? db.jg_monthly_marks.find((m) => m.student_id === sid && m.value !== null)!
    mark.value = Number(mark.value) === 0 ? 1 : 0
    expect((await ins.checkCode(ctx, codes[sid])).status).toBe('outdated')
    expect((await ins.issueCodes(ctx, 'final', admin))[sid]).not.toBe(codes[sid])
    expect((await ins.verificationArchive(ctx)).codes.length).toBeGreaterThan(db.students.length)
    expect(await ins.publicVerify('abc')).toEqual({ status: 'not_found' })
  })

  it('certificates, support plans and excellence points', async () => {
    const ctx = loadFixture(3)
    const c = await ins.getCertificates(ctx, 'final')
    for (const r of c.certificates.excellence) expect(r.pct!).toBeGreaterThanOrEqual(0.85 - 1e-9)
    expect(pr.certificatesHtml(c, 'top3', header)).toContain('شهادة تقدير')
    const plans = await ins.getSupportPlans(ctx)
    if (plans.plans.length) {
      const sid = plans.plans[0].student_id
      const saved = await ins.saveSupportPlan(ctx, sid, { weeks: 6, school_actions: ['حصة دعم'], home_actions: ['مراجعة يومية'] }, admin)
      expect(saved.plans[0].weeks).toBe(6)
      expect(saved.plans[0].school_actions).toEqual(['حصة دعم'])
      expect(pr.supportPlansHtml(saved, header)).toContain('خطة الدعم الفردية')
    }
    await expect(ins.saveSupportPlan(ctx, 'nobody', {}, admin)).rejects.toMatchObject({ status: 404 })
    const sid = db.students[0].id
    const ex = await ins.addPoints(ctx, { student_id: sid, category: 0, points: 5, note: 'مبادرة' }, admin)
    expect(ex.rows.find((r) => r.student_id === sid)!.total).toBe(5)
    await expect(ins.addPoints(ctx, { student_id: sid, category: 9, points: 5 }, admin)).rejects.toMatchObject({ status: 400 })
    const teacher = { profileId: 'p-teacher', role: 'teacher' }
    await expect(ins.deletePoints(ctx, ex.log[0].id, teacher)).rejects.toMatchObject({ status: 403 })
    const stars = await ins.getCertificates(ctx, 'final')
    expect(stars.certificates.stars[0]?.student_id).toBe(sid)
  })
})
