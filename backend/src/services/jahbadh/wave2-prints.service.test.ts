// Jahbadh Wave 2 official outputs on the client's sample classes (brief B6 #17–24, #27, #28, B7).
jest.mock('../../config/supabase', () => require('./jg-test-db').supabaseMock)
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../utils/html-pdf.util', () => ({
  escapeHtml: (x: string) => String(x).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`),
  renderHtmlToPdf: async () => Buffer.from(''),
}))
jest.mock('../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn(async () => undefined) } }))

import { db, resetDb } from './jg-test-db'
import { loadFixture } from './jg-test-fixtures'
import * as off from './official.service'
import * as pr from './print-official.service'
import { monthlyCardsHtml } from './print-monthly.service'
import { reportCardsHtml, type JgPrintHeader } from './print.service'
import * as rc from './report-cards.service'
import { buildZip, crc32 } from '../../utils/zip.util'

const header: JgPrintHeader = { schoolName: 'مدرسة الناجحون', logoUrl: null, educationOffice: 'طرابلس', municipality: 'طرابلس', principal: 'المدير', homeroomTeacher: 'رائد' }
const admin = { profileId: 'p-admin', role: 'admin' }

beforeEach(() => resetDb())

describe('statistics, top students, final sheet (grade 13)', () => {
  it('statistics add up per subject and overall, by gender', async () => {
    const ctx = loadFixture(13)
    const s = await off.getStatistics(ctx)
    const n = db.students.length
    expect(s.overall.enrolled.total).toBe(n)
    expect(s.overall.enrolled.m + s.overall.enrolled.f).toBe(n)
    const o = s.overall
    expect(o.passed.total + o.round2.total + o.failed.total + o.incomplete.total).toBe(o.recorded.total)
    for (const sub of s.subjects) {
      expect(sub.enrolled.total).toBe(n)
      expect(sub.passed.total + sub.round2.total + sub.failed.total).toBeLessThanOrEqual(sub.recorded.total)
    }
    expect(s.estimates.reduce((a, e) => a + e.counts.total, 0)).toBeLessThanOrEqual(o.recorded.total)
    expect(pr.statisticsHtml(s, header, ctx.settings)).toContain('الإحصائية الرسمية')
  })

  it('top students are complete, ranked, at most N, ties kept', async () => {
    const ctx = loadFixture(13)
    const results = await (await import('./grades.service')).getResults(ctx)
    const t = await off.getTopStudents(ctx, 5)
    expect(t.students.length).toBeGreaterThan(0)
    for (const s of t.students) {
      expect(s.rank).toBeLessThanOrEqual(5)
      expect(results.students.find((r) => r.student.id === s.student.id)!.rankable).toBe(true)
    }
    expect(t.students.map((s) => s.rank)).toEqual([...t.students.map((s) => s.rank)].sort((a, b) => a - b))
  })

  it('final sheet summary counts every student once', async () => {
    const ctx = loadFixture(13)
    const f = await off.getFinalSheet(ctx)
    const sm = f.summary
    expect(sm.passed + sm.round2 + sm.failed + sm.incomplete).toBe(sm.enrolled)
    expect(pr.finalSheetHtml(f, header, ctx.settings)).toContain('كشف النتيجة النهائية')
  })
})

describe('review sheet and second round (grade 13)', () => {
  it('review sheet flags missing cells and prints 7 students per page', async () => {
    const ctx = loadFixture(13)
    const r = await off.getReviewSheet(ctx)
    const st24 = r.students.find((s) => s.student.id === 'st24')!
    expect(st24.missing).toBeGreaterThan(0)
    expect(r.missing_cells).toBeGreaterThanOrEqual(st24.missing)
    const html = pr.reviewSheetHtml(r, header, ctx.settings)
    expect(html.match(/class="jg-sheet"/g)!.length).toBe(Math.ceil(r.students.length / 7))
    expect(html).toContain('؟')
  })

  it('entry sheet and notices leave out Article 51 students; timetable dates reach the notices', async () => {
    const ctx = loadFixture(13)
    const sheet = await off.getRound2EntrySheet(ctx)
    expect(sheet.students.some((s) => s.student.id === 'st21')).toBe(false)
    for (const st of sheet.students) expect(st.round2_subjects.length).toBeGreaterThan(0)

    const subject = ctx.grade.subjects[0].id
    const tt = await off.saveRound2Timetable(ctx, [{ jg_subject_id: subject, exam_date: '2027-07-04', exam_time: '09:00', place: 'القاعة 1' }], admin)
    expect(tt.find((t) => t.jg_subject_id === subject)!.day).toBe('الأحد')
    await expect(off.saveRound2Timetable(ctx, [{ jg_subject_id: 'nope' }], admin)).rejects.toThrow()

    const notices = await off.getRound2Notices(ctx)
    expect(notices.notices.some((n) => n.student.id === 'st21')).toBe(false)
    for (const n of notices.notices) for (const s of n.subjects) expect(['need', 'impossible']).toContain(s.need!.kind)
    const html = pr.round2NoticesHtml(notices, header)
    expect(html.match(/class="jg-sheet"/g)!.length).toBe(Math.max(1, Math.ceil(notices.notices.length / 2)))
  })

  it('no-fail grades have no second-round notices', async () => {
    const ctx = loadFixture(3)
    expect((await off.getRound2Notices(ctx)).notices).toEqual([])
  })
})

describe('guardian notices', () => {
  it('lists subjects below the follow rate with a WhatsApp link from the guardian phone', async () => {
    const ctx = loadFixture(13)
    db.students.forEach((s) => (s.custom_fields = { guardian_phone: '0912345678' }))
    const g = await off.getGuardianNotices(ctx, 1)
    expect(g.notices.length).toBeGreaterThan(0)
    for (const n of g.notices) {
      for (const s of n.subjects) expect(s.pct).toBeLessThan(ctx.settings.follow_rate)
      expect(n.whatsapp_url).toMatch(/^https:\/\/wa\.me\/218912345678\?text=/)
    }
    expect(off.waPhone('+218 91 234 5678')).toBe('218912345678')
    expect(off.whatsappUrl('0912345678', 'x'.repeat(5000))!.length).toBeLessThanOrEqual(2000)
    const sent = await off.sendNotices(ctx, [{ student_id: 'st1', title: 't', body: 'b' }], 'guardian_notice', admin)
    expect(sent.sent).toBe(1)
  })
})

describe('monthly report card', () => {
  it('gives each subject its month mark and prints two cards per page', async () => {
    const ctx = loadFixture(3)
    const m = await off.getMonthlyCards(ctx, { stage: 1, month: 1 })
    expect(m.cards.length).toBe(db.students.length)
    const marked = m.cards.flatMap((c) => c.subjects).filter((s) => s.mark !== null)
    expect(marked.length).toBeGreaterThan(0)
    for (const s of marked) expect(s.mark!).toBeLessThanOrEqual(s.max + 1e-9)
    expect(m.cards.some((c) => c.subjects.some((s) => s.previous !== null && s.trend !== null))).toBe(true)
    const html = monthlyCardsHtml(m, header)
    expect(html.match(/class="jg-sheet"/g)!.length).toBe(Math.ceil(m.cards.length / 2))
    // Stage 3 uses April and May only by default: the third month is «—».
    await expect(off.getMonthlyCards(ctx, { stage: 3, month: 2 }).catch((e) => e.code)).resolves.toBe('month_unused')
    expect(off.calendarMonthOf('سبتمبر')).toBe(9)
  })
})

describe('teacher marking sheet', () => {
  it('puts «درجة الأعمال» before the exam, keeps groups whole, carries a QR', async () => {
    const ctx = loadFixture(7)
    // A stage with both coursework and an end-of-semester exam (semester grades).
    const stage = [1, 2, 3].find((n) => ctx.grade.subjects.some((s) => s.components.some((c) => c.stage === n && c.is_exam) && s.components.some((c) => c.stage === n && !c.is_exam)))!
    const d = await off.getMarkingSheets(ctx, 'all', stage, () => '12345678')
    expect(d.sheets.length).toBeGreaterThanOrEqual(ctx.grade.subjects.filter((s) => s.meta.stageMax[stage] > 0).length)
    for (const s of d.sheets) {
      expect(s.qr).toMatch(/^21\d+$/)
      const kinds = s.columns.map((c) => c.kind)
      const works = kinds.indexOf('works')
      const exam = kinds.indexOf('exam')
      if (works >= 0 && exam >= 0) expect(works).toBeLessThan(exam)
    }
    // A group never spans two pages.
    const bySubject = new Map<string, typeof d.sheets>()
    for (const s of d.sheets) bySubject.set(s.subject_id, [...(bySubject.get(s.subject_id) ?? []), s])
    for (const pages of bySubject.values()) {
      const groups = pages.map((p) => new Set(p.columns.map((c) => c.group)))
      for (let i = 1; i < groups.length; i++) for (const g of groups[i]) expect(groups[i - 1].has(g)).toBe(false)
    }
    const html = await pr.markingSheetsHtml(d, header, ctx.settings)
    expect(html).toContain('<svg')
    expect(html).toContain('درجة الأعمال')
  })
})

describe('official report card (B7)', () => {
  it('final scope: official round sentences, 2-decimal %, reference + QR, school identity only', async () => {
    const ctx = loadFixture(13)
    db.students.forEach((s) => (s.profile = { ...s.profile, national_id: '119900000001' }))
    const { cards, options } = await rc.buildReportCards(ctx, 'final')
    const c21 = cards.find((c) => c.student.name === db.students.find((s) => s.id === 'st21')!.profile.first_name)!
    expect(c21.rounds!.first).toMatch(/راسب/)
    const passed = cards.find((c) => c.decision.startsWith('ناجح'))!
    expect(passed.rounds!.first).toMatch(/ناجح/)
    expect(passed.signatureRoles).toEqual(['رائد الفصل', 'مدير المدرسة', 'ولي الأمر'])
    expect(passed.qrSvg).toContain('<svg')
    expect(passed.student.nationalId).toBe('119900000001')
    const html = reportCardsHtml([passed], options)
    expect(html).toMatch(/\d+\.\d{2}%/)
    expect(html).toContain('تنبيه: أي كشط أو تغيير في هذه البطاقة يلغيها')
    expect(html).not.toContain('jahbadh.com')
    expect(html).toContain('jg-fit')
  })

  it('grades 1–5 sign with the exams coordinator; prediction adds «يحتاج للنجاح» at stage scope', async () => {
    const ctx = loadFixture(3)
    const { cards } = await rc.buildReportCards(ctx, 'stage1')
    expect(cards[0].signatureRoles![0]).toBe('منسق الامتحانات')
    const ctx13 = loadFixture(13)
    db.jg_report_card_settings = [{ section_id: 'sec1', academic_year_id: 'y1', options: { prediction: true, autoNotes: true } }]
    const out = await rc.buildReportCards(ctx13, 'stage1')
    expect(out.options.prediction).toBe(true)
    expect(out.options.bw).toBe(false)
    expect(out.cards.some((c) => c.subjects.some((s) => s.need !== undefined && s.need !== null))).toBe(true)
    expect(out.cards.some((c) => c.projection)).toBe(true)
    expect(reportCardsHtml(out.cards.slice(0, 1), out.options)).toContain('يحتاج للنجاح')
  })
})

describe('zip bundle', () => {
  it('stores files with a correct CRC and an end record', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
    const zip = buildZip([{ name: 'PDF/01 - أحمد.pdf', data: Buffer.from('%PDF-1') }, { name: 'all.pdf', data: Buffer.from('x') }])
    expect(zip.readUInt32LE(0)).toBe(0x04034b50)
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50)
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2)
  })
})
