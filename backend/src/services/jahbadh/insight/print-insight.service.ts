import { certificateText, JG_CERTIFICATE_AR, JG_EXPECTED_AR, type JgCertificateKind, type JgNeed } from '../../../lib/jahbadh'
import { escapeHtml as esc, renderHtmlToPdf } from '../../../utils/html-pdf.util'
import { footHtml, officialHeaderHtml, page, type JgPrintHeader } from '../print.service'
import { FIT_SCRIPT, fmtPct2, qrSvgOf, sheet, sheets, signatureRow } from '../print-layout'
import type * as svc from './insight.service'

/**
 * Printed pages of Wave 5 (brief B6-30 … B6-50): A4, school identity only, «تاريخ السحب» in every
 * footer, each page centred and fitted (print-layout.ts). Every figure comes from insight.service.
 */

type Data<F extends (...a: any[]) => any> = Awaited<ReturnType<F>>
const doc = (title: string, body: string, orientation: 'portrait' | 'landscape', fontPx = 9) => page(title, body + FIT_SCRIPT, orientation, fontPx)
export const pdf = (html: string, landscape = false) => renderHtmlToPdf(html, { landscape, margin: { top: '0', bottom: '0' } })
const titleHtml = (t: string) => `<div class="title">${esc(t)}</div>`
const foot = () => footHtml('', { brand: false })
const pct = (p: number | null | undefined) => (p === null || p === undefined ? '—' : fmtPct2(p))
const pts = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${Math.round(x * 10) / 10}`)
const yearOf = (name: string | null) => (name ? `${name} م` : '')

interface Base { section: { name: string; grade_level_name: string }; academic_year: { name: string | null } }
const headOf = (h: JgPrintHeader, d: Base, extra: [string, string][] = []) =>
  officialHeaderHtml(h, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name], ...extra])
const classTitle = (t: string, d: Base) => `${t} — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name}`
const table = (heads: string[], rows: string[][], empty = 'لا توجد بيانات') =>
  `<table><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows.length ? rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}" class="muted">${esc(empty)}</td></tr>`}</table>`
const bullets = (xs: string[]) => (xs.length ? `<ul style="margin:4px 0;padding-inline-start:16px">${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '')
const simple = (h: JgPrintHeader, d: Base, t: string, body: string, landscape = true, sigs: [string, string?][] = [['رائد الفصل', h.homeroomTeacher], ['مدير/ة المدرسة', h.principal]]) =>
  doc(t, sheet(`${headOf(h, d)}${titleHtml(t)}${body}${signatureRow(sigs)}${foot()}`, { orientation: landscape ? 'landscape' : 'portrait', grow: 1.15 }, true), landscape ? 'landscape' : 'portrait')

const needText = (n: JgNeed | null) => (!n ? '—' : n.status === 'secured' ? '✔' : n.status === 'impossible' ? '✖' : String(n.marks))

// ---- B6-30 prediction --------------------------------------------------------------------------------

export function predictionHtml(d: Data<typeof svc.getPrediction>, h: JgPrintHeader): string {
  const t = classTitle('التوقع المبكر', d)
  if (d.rows.length === 1) {
    const r = d.rows[0]
    const body = `${bullets([`النسبة الحالية ${pct(r.current)}، آخر فترة ${pct(r.latest)}، التوقع ${pct(r.projected)} (${r.band ?? '—'})`, `القرار المتوقع: ${r.expected_label}`, r.next_target ?? ''].filter(Boolean))}
      ${table(['المادة', 'المرصود', 'من', 'النسبة', 'المتبقي', 'للنجاح', 'لـ «جيد جداً»', 'لـ «ممتاز»'], r.subjects.map((s) => [esc(s.name), String(s.recorded), String(s.of), pct(s.pct), String(s.remaining), needText(s.to_pass), needText(s.to_very_good), needText(s.to_excellent)]))}
      <div class="muted">✔ = محقق — ✖ = لا يكفي المتبقي — الرقم = ما يلزم من الدرجات المتبقية</div>`
    return simple(h, d, `${t} — ${r.name}`, body, false)
  }
  const rows = d.rows.map((r, i) => [String(i + 1), esc(r.name), pct(r.current), pct(r.latest), pct(r.projected), esc(r.band ?? '—'), String(r.at_risk.length), esc(r.at_risk.join('، ')), esc(JG_EXPECTED_AR[r.expected])])
  return simple(h, d, t, table(['م', 'الاسم', 'النسبة الحالية', 'آخر فترة', 'التوقع', 'التقدير المتوقع', 'مواد مهددة', 'المواد المهددة', 'القرار المتوقع'], rows))
}

// ---- B6-31 edge, B6-32 inflation, B6-33 comments, B6-34 weak items -----------------------------------

export function edgeHtml(d: Data<typeof svc.getEdge>, h: JgPrintHeader): string {
  const rows = d.rows.map((r, i) => [String(i + 1), esc(r.name), esc(r.subject), pct(r.pct), pct(r.pass_line), pts(r.gap), r.status === 'below' ? 'دون الحد' : 'فوق الحد', String(r.needed || '—'), String(r.remaining), esc(r.intervention)])
  return simple(h, d, classTitle('الطلاب على الحافة', d), `<div class="muted">هامش القرب من الحد: ±${d.margin} نقطة — أو يحتاج للنجاح ≤ ${d.need_max} درجة</div>${table(['م', 'الاسم', 'المادة', 'النسبة الحالية', 'الحد', 'الفجوة', 'الوضع', 'يحتاج (درجة)', 'المتبقي', 'التدخل المقترح'], rows)}`)
}

export function inflationHtml(d: Data<typeof svc.getInflation>, h: JgPrintHeader): string {
  const rows = d.subjects.map((s, i) => [String(i + 1), esc(s.name), esc(s.teacher ?? '—'), String(s.recorded), pct(s.works), pct(s.exam), pts(s.gap === null ? null : s.gap * 100), pts(s.max_gap === null ? null : s.max_gap * 100), String(s.over_threshold), esc(s.verdict_label)])
  const top = d.top_gaps.map((g, i) => [String(i + 1), esc(g.name), esc(g.subject), pct(g.works), pct(g.exam), pts(g.gap * 100)])
  return simple(h, d, classTitle('مؤشر تضخم الأعمال', d), `<div class="muted">${esc(d.note)} — حد الفجوة الفردية اللافتة ${Math.round(d.threshold * 100)} نقطة</div>
    ${table(['م', 'المادة', 'المعلم', 'المرصودون', 'متوسط الأعمال', 'متوسط الامتحان', 'الفجوة', 'أعلى فجوة', 'عدد ≥ الحد', 'الحكم'], rows)}
    <div style="margin-top:4px;font-weight:700">أكبر الفجوات الفردية (للتحقق)</div>${table(['م', 'الاسم', 'المادة', 'الأعمال', 'الامتحان', 'الفجوة'], top, 'لا توجد فجوات فردية تبلغ الحد')}`)
}

export function autoCommentsHtml(d: Data<typeof svc.getAutoComments>, h: JgPrintHeader): string {
  const rows = d.rows.filter((r) => r.text).map((r, i) => [String(i + 1), esc(r.name), pct(r.pct), esc(r.text)])
  return simple(h, d, `${classTitle('الملاحظات التلقائية', d)} — ${d.stage_names[d.stage - 1] ?? ''}`, table(['م', 'الاسم', 'النسبة', 'الملاحظة'], rows), false)
}

export function weakItemsHtml(d: Data<typeof svc.getWeakItems>, h: JgPrintHeader): string {
  const grid = table(['الاسم', ...d.items.map((i) => i.name)], d.grid.map((g) => [esc(g.name), ...g.cells.map((c) => (c === null ? '—' : `<span style="color:${c < 0.5 ? 'var(--jg-danger)' : 'inherit'}">${Math.round(c * 100)}%</span>`))]))
  const avg = table(['البند', 'المكوّن', 'المتوسط', 'دون 50%'], d.items.map((i) => [esc(i.name), esc(i.component), pct(i.avg), pct(i.below_share)]))
  const plan = table(['البند الأضعف', 'المتوسط', 'الخطة', 'الطلاب'], d.weakest.map((w) => [esc(w.name), pct(w.avg), esc(w.plan_label), esc(w.below_names.join('، '))]))
  return simple(h, d, `${classTitle('خريطة البنود', d)} — ${d.subject}`, `${grid}<div style="margin-top:4px"></div>${avg}<div style="margin-top:4px"></div>${plan}`)
}

// ---- B6-35 what-if, B6-37 auditor, B6-38 approval, B6-39 verification -------------------------------

export function whatIfHtml(d: Data<typeof svc.runWhatIf>, h: JgPrintHeader): string {
  const sc = d.scenario
  const lines = [
    sc.totalMin !== undefined ? `حد النجاح في المادة: ${pct(d.current.totalMin)} ← ${pct(sc.totalMin)}` : '',
    sc.examMin !== undefined ? `حد الامتحان: ${pct(d.current.examMin)} ← ${pct(sc.examMin)}` : '',
    sc.addMarks ? `إضافة ${sc.addMarks} درجة إلى الأعمال (${sc.addSubject === 'all' ? 'كل المواد' : 'مادة واحدة'})` : '',
    sc.jabrPlusOne !== undefined ? `درجة واحدة في مادة واحدة (م 122): ${sc.jabrPlusOne ? 'مفعّلة' : 'معطّلة'}` : '',
  ].filter(Boolean)
  const counts = table(['', 'ناجح', 'دور ثاني', 'راسب'], [['الآن', String(d.now.pass), String(d.now.round2), String(d.now.fail)], ['السيناريو', String(d.after.pass), String(d.after.round2), String(d.after.fail)]])
  const changed = table(['م', 'الاسم', 'القرار الآن', 'القرار في السيناريو', 'مواد متعثرة قبل', 'بعد'], d.changed.map((c, i) => [String(i + 1), esc(c.name), esc(c.before), esc(c.after), String(c.failing_before), String(c.failing_after)]), 'لا يتغير قرار أي طالب')
  return simple(h, d, classTitle('محاكي ماذا لو', d), `${bullets(lines)}<div class="muted">يعمل على ${d.considered} طالباً نتائجهم مكتملة، ولا يغيّر أي درجة.</div>${counts}<div style="margin-top:4px"></div>${changed}`)
}

export function auditHtml(d: Data<typeof svc.getAudit>, h: JgPrintHeader): string {
  const lvl = { error: 'خطأ', warning: 'تنبيه', roster: 'الأسماء' }
  const rows = d.issues.map((i, k) => [String(k + 1), esc(i.name), esc(i.subject ?? '—'), i.stage ? esc(d.stage_names[i.stage - 1] ?? String(i.stage)) : '—', lvl[i.level], esc(i.label), esc(i.detail ?? '')])
  return simple(h, d, classTitle('مدقق الإدخال', d), `<div class="muted">أخطاء ${d.errors} — تنبيهات ${d.warnings} — ملاحظات على الأسماء ${d.roster}</div>${table(['م', 'الاسم', 'المادة', 'المرحلة', 'النوع', 'الملاحظة', 'التفاصيل'], rows, 'لا توجد ملاحظات')}`)
}

export function approvalHtml(d: Data<typeof svc.getApproval>, h: JgPrintHeader): string {
  const status = !d.approved ? 'لم يُعتمد بعد' : d.status === 'matches' ? 'مطابق للنسخة المعتمدة' : `${d.changes.length} تعديل بعد الاعتماد`
  const rows = d.changes.map((c, i) => [String(i + 1), esc(c.name), esc(c.subject), c.stage === 'round2' ? 'الدور الثاني' : c.stage === 'cells' ? 'الخلايا' : esc(d.stage_names[(c.stage as number) - 1] ?? String(c.stage)), esc(String(c.approved ?? '—')), esc(String(c.current ?? '—'))])
  return simple(h, d, classTitle('سجل الاعتماد', d), `${bullets([`الحالة: ${status}`, d.approved ? `تاريخ الاعتماد: ${String(d.approved.at).slice(0, 16).replace('T', ' ')}` : ''].filter(Boolean))}${table(['م', 'الاسم', 'المادة', 'المرحلة', 'المعتمد', 'الحالي'], rows, 'لا تعديلات')}`, false)
}

export async function verificationArchiveHtml(d: Data<typeof svc.verificationArchive>, h: JgPrintHeader): Promise<string> {
  const rows = await Promise.all(d.codes.map(async (c: any, i: number) => [String(i + 1), esc(c.summary?.name ?? ''), esc(c.scope), `<span class="num">${esc(c.code)}</span>`, String(c.issued_at).slice(0, 10), await qrSvgOf(c.url, 12)]))
  return simple(h, d, classTitle('أرشيف رموز التحقق', d), table(['م', 'الاسم', 'النطاق', 'الرمز', 'تاريخ الإصدار', 'QR'], rows, 'لم تُصدر رموز بعد'), false)
}

// ---- B6-40 certificates ---------------------------------------------------------------------------------

export function certificatesHtml(d: Data<typeof svc.getCertificates>, kind: JgCertificateKind, h: JgPrintHeader): string {
  const list = d.certificates[kind]
  const t = `شهادات التقدير — ${JG_CERTIFICATE_AR[kind]}`
  if (!list.length) return simple(h, d, t, '<div class="muted" style="text-align:center;padding:20mm">لا يوجد مستحقون لهذه الفئة في هذه الفترة</div>')
  const pages = list.map((r) => `${officialHeaderHtml(h, [['العام الدراسي', yearOf(d.academic_year.name)]])}
    <div style="border:3px double var(--jg-navy);border-radius:6mm;padding:10mm 12mm;margin-top:4mm;text-align:center">
      <div style="font-size:30px;font-weight:800;color:var(--jg-navy)">شهادة تقدير</div>
      <div style="font-size:14px;margin-top:2mm">${esc(JG_CERTIFICATE_AR[kind])}</div>
      <div style="font-size:24px;font-weight:800;margin:8mm 0 4mm">${esc(r.name)}</div>
      <div style="font-size:14px;line-height:1.9">${esc(certificateText(kind, r.gender, d.basic, d.scope_name).replace('…', `في الصف ${d.section.grade_level_name} — الشعبة ${d.section.name}`))}</div>
      ${r.pct !== null ? `<div style="margin-top:3mm;font-size:12px">النسبة: <b>${pct(r.pct)}</b>${r.rank ? ` — الترتيب: <b>${r.rank}</b>` : ''}${r.detail ? ` — ${esc(r.detail)}` : ''}</div>` : ''}
      <div style="margin-top:10mm">${signatureRow([['رائد الفصل', h.homeroomTeacher], ['مدير/ة المدرسة', h.principal]])}</div>
    </div>${foot()}`)
  return doc(t, sheets(pages, { orientation: 'landscape', grow: 1.2 }), 'landscape', 10)
}

// ---- B6-41 support plans, B6-42 absence impact ---------------------------------------------------------

export function supportPlansHtml(d: Data<typeof svc.getSupportPlans>, h: JgPrintHeader): string {
  const t = classTitle('خطة الدعم الفردية', d)
  if (!d.plans.length) return simple(h, d, t, '<div class="muted" style="text-align:center;padding:20mm">لا يوجد طالب يحتاج خطة دعم حالياً</div>', false)
  const pages = d.plans.map((p) => {
    const subjects = table(['المادة', 'النسبة الحالية', 'يحتاج للنجاح', 'أضعف بند', 'نسبته', 'الهدف الأسبوعي'], p.subjects.map((s) => [esc(s.name), pct(s.pct), needText(s.to_pass), esc(s.weakest?.name ?? '—'), pct(s.weakest?.pct ?? null), esc(s.weekly_goal)]))
    const follow = table(['الأسبوعان', 'ما تحقق', 'ملاحظة المعلم', 'توقيع ولي الأمر'], Array.from({ length: Math.ceil(p.weeks / 2) }, (_, i) => [String(i + 1), '', '', '']))
    return `${headOf(h, d)}${titleHtml(`${t} — ${p.name}`)}
      ${bullets([`المستوى الحالي: ${p.current_band ?? '—'} (${pct(p.current)}) — المتوقع: ${p.projected_band ?? '—'} (${pct(p.projected)})`, `مدة الخطة: ${p.weeks} أسابيع`])}
      ${subjects}
      <div style="display:flex;gap:6mm;margin-top:3mm"><div style="flex:1"><b>إجراءات المدرسة</b>${bullets(p.school_actions)}</div><div style="flex:1"><b>إجراءات البيت</b>${bullets(p.home_actions)}</div></div>
      <div style="margin-top:2mm;font-weight:700">متابعة كل أسبوعين</div>${follow}
      ${signatureRow([['المعلم/ـة', h.homeroomTeacher], ['ولي الأمر'], ['الطالب/ـة']])}${foot()}`
  })
  return doc(t, sheets(pages, { orientation: 'portrait', grow: 1.1 }), 'portrait', 9)
}

export function absenceImpactHtml(d: Data<typeof svc.getAbsenceImpact>, h: JgPrintHeader): string {
  const bands = table(['أيام الغياب', 'العدد', 'متوسط النسبة'], d.bands.map((b) => [b.label, String(b.count), pct(b.avg)]))
  const rows = [...d.rows].sort((a, b) => b.days - a.days).map((r, i) => [String(i + 1), esc(r.name), String(r.days), String(r.unexcused), pct(r.pct)])
  return simple(h, d, classTitle('أثر الغياب', d), `${bullets([
    d.r !== null ? `معامل الارتباط بين الغياب والنسبة: ${Math.round(d.r * 100) / 100}` : 'البيانات لا تكفي لحساب الارتباط',
    d.slope_points_per_day !== null ? `كل يوم غياب ≈ ${pts(d.slope_points_per_day)} نقطة في النسبة العامة في هذا الفصل` : '',
    d.note,
  ].filter(Boolean))}${bands}<div style="margin-top:4px"></div>${table(['م', 'الاسم', 'أيام الغياب', 'بدون عذر', 'النسبة'], rows)}
  <div style="margin-top:4px"><b>رسالة لولي الأمر:</b> ${esc(d.parent_message)}</div>`, false)
}

// ---- B6-46 entry progress, B6-48 excellence, B6-49 end of year ---------------------------------------------

export function entryProgressHtml(d: Data<typeof svc.getEntryProgress>, h: JgPrintHeader): string {
  const rows = d.rows.map((r, i) => [String(i + 1), esc(r.subject), esc(r.stage_name), esc(r.teacher ?? '—'), `${Math.round(r.pct * 100)}%`, esc(r.status_label), esc(r.deadline ?? '—'), esc(r.reminder ?? '')])
  return simple(h, d, classTitle('متابعة الرصد', d), `<div class="muted">إنجاز المرحلة الحالية: ${d.current_pct === null ? '—' : `${Math.round(d.current_pct * 100)}%`}</div>${table(['م', 'المادة', 'المرحلة', 'المعلم', 'الإنجاز', 'الحالة', 'الموعد', 'رسالة التذكير'], rows)}`)
}

export function excellenceHtml(d: Data<typeof svc.getExcellence>, h: JgPrintHeader): string {
  const medal = (m: string | null) => (m === 'gold' ? '🥇' : m === 'silver' ? '🥈' : m === 'bronze' ? '🥉' : '')
  const rows = d.rows.filter((r) => r.total !== 0).map((r) => [`${r.rank} ${medal(r.medal)}`, esc(r.name), ...r.per_category.map(String), `<b>${r.total}</b>`])
  const stars = table(['الفئة', 'النجم', 'النقاط'], d.stars.map((s) => [esc(s.category), esc(s.students.join('، ') || '—'), String(s.points)]))
  return simple(h, d, classTitle('نقاط التميز', d), `${table(['الترتيب', 'الاسم', ...d.categories, 'المجموع'], rows, 'لا نقاط بعد')}<div style="margin-top:4px;font-weight:700">نجم كل فئة</div>${stars}`)
}

export function endOfYearHtml(d: Data<typeof svc.getEndOfYear>, h: JgPrintHeader): string {
  const T = d.totals
  const row = (label: string, x: { m: number; f: number; total: number }) => [label, String(x.m), String(x.f), String(x.total)]
  const totals = table(['', 'ذكور', 'إناث', 'المجموع'], [row('المقيدون', T.enrolled), row('الممتحنون', T.examined), row('الناجحون / المنقولون', T.passed), row('الدور الثاني', T.round2), row('الراسبون', T.failed), row('غير محسومة', T.undecided)])
  const subjects = table(['المادة', 'العدد', 'المتوسط', 'الأعلى', 'الأدنى', 'نسبة النجاح', 'الممتازون', 'التقدير'], d.subjects.map((s) => [esc(s.name), String(s.count), pct(s.average), pct(s.highest), pct(s.lowest), pct(s.pass_rate), String(s.excellent), esc(s.band ?? '—')]))
  const manual = (d.manual ?? {}) as Record<string, any>
  const compare = Object.keys(manual).length ? table(['البند', 'العام الماضي'], Object.entries(manual).filter(([k]) => k !== 'free_line').map(([k, v]) => [esc(k), esc(String(v))])) : ''
  const body = `${totals}<div class="muted" style="margin-top:3px">المتوسط العام ${pct(d.averages.all)} — الذكور ${pct(d.averages.boys)} — الإناث ${pct(d.averages.girls)}${d.attendance_rate !== null ? ` — نسبة الحضور التقريبية ${pct(d.attendance_rate)}` : ''}</div>
    ${subjects}
    <div style="display:flex;gap:6mm;margin-top:3mm"><div style="flex:1"><b>الأوائل الخمسة</b>${bullets(d.top5.map((t) => `${t.rank}. ${t.name} (${pct(t.pct)})`))}</div><div style="flex:1"><b>الأكثر تحسناً</b>${bullets(d.most_improved.map((t) => `${t.name} (${t.gain})`))}</div></div>
    ${compare}
    <div style="margin-top:2mm"><b>توصيات</b>${bullets([...d.recommendations, manual.free_line ? String(manual.free_line) : ''].filter(Boolean))}</div>
    <div class="muted">حالة الاعتماد: ${d.approval ? `معتمد في ${String(d.approval.at).slice(0, 10)}` : 'غير معتمد بعد'}</div>`
  return simple(h, d, classTitle('التقرير الختامي', d), body, false, [['رائد الفصل', h.homeroomTeacher], ['منسق الامتحانات'], ['مدير/ة المدرسة', h.principal]])
}

// ---- campus-wide prints ----------------------------------------------------------------------------------

const campusDoc = (h: JgPrintHeader, t: string, body: string) =>
  doc(t, sheet(`${officialHeaderHtml(h, [])}${titleHtml(t)}${body}${signatureRow([['مدير/ة المدرسة', h.principal]])}${foot()}`, { orientation: 'landscape', grow: 1.1 }, true), 'landscape')

export function principalHtml(d: Data<typeof svc.getPrincipalDashboard>, h: JgPrintHeader): string {
  const rows = d.rows.map((r) => [String(r.rank), esc(r.grade), esc(r.section), String(r.enrolled), String(r.examined), pct(r.average), String(r.passed), String(r.round2), String(r.failed), String(r.undecided), pct(r.pass_rate), String(r.excellent), String(r.needs_support), pct(r.entry_completion), String(r.entry_errors), esc(r.weakest_subject ?? '—'), esc(r.strongest_subject ?? '—')])
  const t = d.totals
  return campusDoc(h, 'لوحة المدير', `${table(['الترتيب', 'الصف', 'الشعبة', 'المقيدون', 'الممتحنون', 'المتوسط', 'ناجح', 'دور ثاني', 'راسب', 'غير محسوم', 'نسبة النجاح', 'ممتاز', 'يحتاج دعماً', 'إنجاز الرصد', 'أخطاء الرصد', 'أضعف مادة', 'أقوى مادة'], rows)}
    <div class="muted" style="margin-top:3px">المجموع: المقيدون ${t.enrolled} — الناجحون ${t.passed} — الدور الثاني ${t.round2} — الراسبون ${t.failed} — نسبة النجاح ${pct(t.pass_rate)}</div>${bullets(d.reading)}`)
}

export function allocationHtml(d: Data<typeof svc.getAllocation>, h: JgPrintHeader): string {
  const sum = table(['الشعبة', 'العدد', 'ذكور', 'إناث', 'معيدون', 'المتوسط', 'الفرق عن العام', 'ممتاز', 'ضعيف'], d.sections.map((s) => [esc(s.name), String(s.count), String(s.boys), String(s.girls), String(s.repeaters), pct(s.average), pts(s.gap), String(s.excellent), String(s.weak)]))
  const list = table(['الشعبة', 'الاسم', 'الجنس', 'الصفة', 'النسبة', 'الشعبة السابقة'], d.list.map((s) => [esc(s.section), esc(s.name), s.gender === 'f' ? 'أنثى' : s.gender === 'm' ? 'ذكر' : '—', esc(s.status), pct(s.pct), esc(s.previous_section ?? '—')]))
  return campusDoc(h, 'توزيع الشعب للعام القادم', `${sum}<div style="margin-top:4px"></div>${list}`)
}

export function fairnessHtml(d: Data<typeof svc.getFairness>, h: JgPrintHeader): string {
  const head = ['الشعبة', ...d.subjects.map((s) => s.name)]
  const rows = d.sections.map((sec) => [esc(sec), ...d.subjects.map((s) => {
    const c = d.cells.find((x) => x.section === sec && x.subject === s.id)
    if (!c || c.gap === null) return '—'
    const v = Math.round(c.gap * 1000) / 10
    return `<span style="${c.flagged ? 'color:var(--jg-danger);font-weight:700' : ''}">${v > 0 ? '+' : ''}${v}</span>`
  })])
  const top = table(['الشعبة', 'المادة', 'المعلم', 'الفرق المعدّل', 'التوصية'], d.top_gaps.map((g) => [esc(g.section), esc(g.subject_name), esc(g.teacher ?? '—'), pts((g.gap ?? 0) * 100), esc(g.recommendation)]), 'لا فروق تتجاوز الحد')
  return campusDoc(h, 'عدالة التصحيح بين الشعب', `<div class="muted">الفرق المعدّل = (نسبة الطالب في المادة − مستواه في بقية المواد) متوسطاً في الشعبة ناقص متوسط الصف كله — الحد ±${Math.round(d.threshold * 100)} نقطة</div>${table(head, rows)}<div style="margin-top:4px"></div>${top}`)
}
