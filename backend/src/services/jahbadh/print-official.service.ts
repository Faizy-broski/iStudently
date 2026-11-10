import { decisionTone, fmtMark, fmtPct, genderForm, learnerWord, type JgRound2Need } from '../../lib/jahbadh'
import { escapeHtml as esc, renderHtmlToPdf } from '../../utils/html-pdf.util'
import type { JgSettings } from './grades.service'
import type {
  JgFinalSheet,
  JgGuardianNotices,
  JgMarkingSheets,
  JgReviewSheet,
  JgRound2EntrySheet,
  JgRound2Notices,
  JgSplit,
  JgStatistics,
  JgTopStudents,
} from './official.service'
import { footHtml, officialHeaderHtml, page, type JgPrintHeader } from './print.service'
import { cutLine, FIT_SCRIPT, fmtPct2, qrSvgOf, schoolExtras, sheet, sheets, signatureRow } from './print-layout'

/**
 * Printed official outputs of Wave 2 (brief B6-17 … B6-28): A4, school identity only, «تاريخ السحب»
 * in every footer, each page centred and fitted (print-layout.ts).
 */

const yearOf = (name: string | null) => (name ? `${name} م` : '')
const doc = (title: string, body: string, orientation: 'portrait' | 'landscape', fontPx = 9) => page(title, body + FIT_SCRIPT, orientation, fontPx)
const pdf = (html: string, landscape = false) => renderHtmlToPdf(html, { landscape, margin: { top: '0', bottom: '0' } })
const title = (t: string) => `<div class="title">${esc(t)}</div>`
const head = (header: JgPrintHeader, end: [string, string][]) => officialHeaderHtml(header, end)
const foot = (label = '') => footHtml(label, { brand: false })
const chip = (decision: string) => `<span class="chip t-${decisionTone(decision || '—')}">${esc(decision)}</span>`
const pctOrDash = (p: number | null) => (p === null ? '—' : fmtPct(p, 1))

// ---- B6-17 statistics ----------------------------------------------------------------------------

export function statisticsHtml(d: JgStatistics, header: JgPrintHeader, settings: JgSettings): string {
  const t = `الإحصائية الرسمية — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name} — ${yearOf(d.academic_year.name)}`
  const s3 = (x: JgSplit) => `<td class="num">${x.m}</td><td class="num">${x.f}</td><td class="num" style="font-weight:700">${x.total}</td>`
  const groupHead = (labels: string[]) =>
    `<tr><th rowspan="2">المادة</th>${labels.map((l) => `<th colspan="3">${esc(l)}</th>`).join('')}<th rowspan="2">نسبة النجاح</th></tr><tr>${labels.map(() => '<th>ذكور</th><th>إناث</th><th>المجموع</th>').join('')}</tr>`
  const passLabel = d.no_fail ? 'المنقولون' : 'الناجحون'
  const subjects = `<table>${groupHead(['المقيدون', 'المرصودون', passLabel, 'الدور الثاني', 'الراسبون'])}${d.subjects
    .map((s) => `<tr><td class="start" style="font-weight:700">${esc(s.name)}</td>${s3(s.enrolled)}${s3(s.recorded)}${s3(s.passed)}${s3(s.round2)}${s3(s.failed)}<td class="num">${pctOrDash(s.pass_rate)}</td></tr>`)
    .join('')}</table>`
  const o = d.overall
  const overall = `<table style="margin-top:5px"><tr><th rowspan="2">النتيجة العامة</th>${['المقيدون', 'المرصودون', `${passLabel} / المنقولون`, 'الدور الثاني', 'الراسبون', 'غير مكتملة']
    .map((l) => `<th colspan="3">${esc(l)}</th>`)
    .join('')}<th rowspan="2">نسبة النجاح</th></tr><tr>${Array.from({ length: 6 }, () => '<th>ذكور</th><th>إناث</th><th>المجموع</th>').join('')}</tr>
    <tr><td style="font-weight:700">العدد</td>${s3(o.enrolled)}${s3(o.recorded)}${s3(o.passed)}${s3(o.round2)}${s3(o.failed)}${s3(o.incomplete)}<td class="num" style="font-weight:800">${pctOrDash(o.pass_rate)}</td></tr></table>`
  const est = `<table style="margin-top:5px"><tr><th>التقدير العام</th>${d.estimates.map((e) => `<th>${esc(e.label)}</th>`).join('')}</tr>
    ${(['m', 'f', 'total'] as const).map((k) => `<tr><td style="font-weight:700">${k === 'm' ? 'ذكور' : k === 'f' ? 'إناث' : 'المجموع'}</td>${d.estimates.map((e) => `<td class="num">${e.counts[k]}</td>`).join('')}</tr>`).join('')}</table>`
  const i = d.indicators
  const ind = `<table style="margin-top:5px"><tr><th>متوسط النسبة</th><th>أعلى نسبة</th><th>أدنى نسبة</th><th>متوسط الذكور</th><th>متوسط الإناث</th><th>أفضل مادة (نسبة النجاح)</th><th>أضعف مادة</th></tr>
    <tr>${[i.average_pct, i.highest_pct, i.lowest_pct, i.average_pct_boys, i.average_pct_girls].map((p) => `<td class="num">${pctOrDash(p)}</td>`).join('')}<td>${esc(i.best_subject ?? '—')}</td><td>${esc(i.weakest_subject ?? '—')}</td></tr></table>`
  const x = schoolExtras(settings)
  const body = `${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}${title(t)}${subjects}${overall}${est}${ind}
    ${signatureRow([['رائد الفصل', header.homeroomTeacher], ['منسق الامتحانات', x.examsCoordinator], ['مدير/ة المدرسة', header.principal]])}${foot()}`
  return doc(t, sheet(body, { orientation: 'landscape', grow: 1.15 }, true), 'landscape')
}

// ---- B6-22 top students --------------------------------------------------------------------------

export function topStudentsHtml(d: JgTopStudents, header: JgPrintHeader): string {
  const t = `كشف الأوائل — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name} — ${yearOf(d.academic_year.name)}`
  const word = learnerWord(d.grade_code)
  const medal = (r: number) => (r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : '')
  const rows = d.students
    .map((s) => `<tr><td class="num" style="font-weight:800">${s.rank} ${medal(s.rank)}</td><td class="start" style="font-weight:700">${esc(s.student.name)}</td><td class="num">${fmtMark(s.total)} / ${fmtMark(s.max)}</td><td class="num">${fmtPct2(s.pct)}</td><td>${esc(s.estimate ?? '')}</td><td>${chip(s.decision)}</td></tr>`)
    .join('')
  const body = `${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}${title(t)}
    <table style="font-size:11px"><tr><th>الترتيب</th><th>اسم ${esc(word)}/ـة</th><th>المجموع</th><th>النسبة</th><th>التقدير</th><th>القرار</th></tr>${rows || '<tr><td colspan="6" class="muted">لا توجد نتائج مكتملة بعد</td></tr>'}</table>
    ${signatureRow([['رائد الفصل', header.homeroomTeacher], ['مدير/ة المدرسة', header.principal]])}${foot()}`
  return doc(t, sheet(body, { grow: 1.3 }, true), 'portrait', 10)
}

// ---- B6-28 final result sheet ----------------------------------------------------------------------

export function finalSheetHtml(d: JgFinalSheet, header: JgPrintHeader, settings: JgSettings): string {
  const r = d.results
  const t = `كشف النتيجة النهائية — الصف ${r.section.grade_level_name} — الشعبة ${r.section.name} — ${yearOf(r.academic_year.name)}`
  const word = learnerWord(r.rule.grade_code)
  const th = `<tr><th>م</th><th style="min-width:110px">اسم ${esc(word)}/ـة</th>${r.subjects
    .map((s) => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:64px;font-size:8px">${esc(s.short_name)}</th>`)
    .join('')}<th>المجموع</th><th>النسبة</th><th>التقدير</th><th>الترتيب</th><th>القرار</th></tr>`
  const maxRow = `<tr style="background:var(--jg-gold-soft);font-weight:800"><td></td><td>الدرجة العظمى</td>${r.subjects.map((s) => `<td class="num">${fmtMark(s.subject_max)}</td>`).join('')}<td class="num">${fmtMark(r.grand_max)}</td><td colspan="4"></td></tr>`
  const rows = r.students
    .map((st, i) => `<tr><td class="num">${i + 1}</td><td class="start">${esc(st.student.name)}</td>${r.subjects
      .map((s) => {
        const x = st.subjects[s.id]
        const bad = x.result.result === 'fail' ? ' class="t-destructive"' : x.result.result === 'round2' ? ' class="t-warning"' : ''
        return `<td${bad}><span class="num">${fmtMark(x.result.final)}</span>${x.jabr ? '<sup style="color:var(--jg-success)">+1</sup>' : ''}</td>`
      })
      .join('')}<td class="num" style="font-weight:700">${fmtMark(st.total)}</td><td class="num">${fmtPct2(st.pct)}</td><td>${esc(st.estimate ?? '')}</td><td class="num">${st.rank ?? '—'}</td><td>${chip(st.decision)}</td></tr>`)
    .join('')
  const sm = d.summary
  const summary = `<table style="margin-top:5px;width:70%;margin-inline:auto"><tr><th>الملخص</th><th>المقيدون</th><th>${r.rule.no_fail ? 'المنقولون' : 'الناجحون / المنقولون'}</th><th>الدور الثاني</th><th>الراسبون</th><th>غير مكتملة</th><th>نسبة النجاح</th></tr>
    <tr><td style="font-weight:700">العدد</td><td class="num">${sm.enrolled}</td><td class="num">${sm.passed}</td><td class="num">${sm.round2}</td><td class="num">${sm.failed}</td><td class="num">${sm.incomplete}</td><td class="num" style="font-weight:800">${pctOrDash(sm.pass_rate)}</td></tr></table>
    ${r.rule.no_fail ? '<div class="muted" style="text-align:center">(الصفوف 1–3: نقل تلقائي)</div>' : ''}`
  const x = schoolExtras(settings)
  const body = `${head(header, [['العام الدراسي', yearOf(r.academic_year.name)], ['الصف', r.section.grade_level_name], ['الشعبة', r.section.name]])}${title(t)}<table>${th}${maxRow}${rows}</table>${summary}
    ${signatureRow([['رائد الفصل', header.homeroomTeacher], ['منسق الامتحانات', x.examsCoordinator], ['مدير/ة المدرسة', header.principal]])}${foot()}`
  return doc(t, sheet(body, { orientation: 'landscape', grow: 1.1 }, true), 'landscape')
}

// ---- B6-19 review sheet (7 students per page) ------------------------------------------------------

export function reviewSheetHtml(d: JgReviewSheet, header: JgPrintHeader, settings: JgSettings): string {
  const t = `كشف المراجعة — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name} — ${yearOf(d.academic_year.name)}`
  const x = schoolExtras(settings)
  const stageName = (n: number) => d.stage_names[n - 1] ?? String(n)
  const pageSize = 7
  const pages: string[] = []
  const nPages = Math.max(1, Math.ceil(d.students.length / pageSize))
  for (let p = 0; p < nPages; p++) {
    const chunk = d.students.slice(p * pageSize, (p + 1) * pageSize)
    const subjHead = `<tr><th style="width:110px">البيان</th>${d.subjects.map((s) => `<th style="font-size:7.5px">${esc(s.name)}</th>`).join('')}<th>النشاط والغياب</th></tr>`
    const blocks = chunk
      .map((st, i) => {
        const cell = (c: { value: number | null; max: number; flags: string[] } | undefined) => {
          if (!c) return '<td class="muted">—</td>'
          const missing = c.flags.includes('missing')
          const style = [
            missing ? 'background:var(--jg-warning-soft);color:var(--jg-warning);font-weight:800' : '',
            c.flags.includes('over_max') ? 'color:var(--jg-danger);font-weight:800' : '',
            c.flags.includes('low') ? 'color:var(--jg-danger)' : '',
            c.flags.includes('jump') ? 'outline:2px solid var(--jg-danger);outline-offset:-2px' : '',
          ].filter(Boolean).join(';')
          return `<td class="num" style="${style}">${missing ? '؟' : fmtMark(c.value)}</td>`
        }
        const stageRows = d.stages
          .map((n) => {
            const a = st.activities[n]
            const act = a ? [a.art, a.music, a.pe].filter(Boolean).join(' / ') + (a.excused != null || a.unexcused != null ? ` — غ م ${a.excused ?? 0} / غ غ م ${a.unexcused ?? 0}` : '') : ''
            return `<tr><td class="start">${esc(stageName(n))}</td>${d.subjects.map((s) => cell(st.stages[n]?.[s.id])).join('')}<td class="start" style="font-size:7px">${esc(act)}</td></tr>`
          })
          .join('')
        const totalRow = `<tr style="background:var(--jg-blue-soft);font-weight:700"><td class="start">المجموع / العظمى</td>${d.subjects.map((s) => `<td class="num">${fmtMark(st.totals[s.id]?.value ?? null)}<span class="muted">/${fmtMark(s.subject_max)}</span></td>`).join('')}<td></td></tr>`
        const resultRow = `<tr><td class="start">النتيجة</td>${d.subjects.map((s) => `<td style="font-size:7.5px">${esc(st.results[s.id]?.label ?? '')} ${esc(st.results[s.id]?.trend ?? '')}</td>`).join('')}<td></td></tr>`
        const summary = `<tr style="background:#F8FAFD"><td colspan="${d.subjects.length + 2}" class="start" style="font-size:8px">
          <b>${p * pageSize + i + 1}. ${esc(st.student.name)}</b> — الخانات الناقصة: <b>${st.missing}</b> | المجموع: <span class="num">${fmtMark(st.total)}/${fmtMark(st.max)}</span> | النسبة: <span class="num">${fmtPct2(st.pct)}</span> | التقدير: ${esc(st.estimate ?? '—')} | الترتيب: ${st.rank ?? '—'} | القرار: ${chip(st.decision)} | تمت المراجعة ☐</td></tr>`
        return `<table style="margin-bottom:3px">${summary}${subjHead}${stageRows}${totalRow}${resultRow}</table>`
      })
      .join('')
    const footer = p === nPages - 1
      ? `<table style="margin-top:4px"><tr><th>المادة</th>${d.subjects.map((s) => `<th style="font-size:7.5px">${esc(s.name)}</th>`).join('')}</tr>
        ${(['average', 'passed', 'round2', 'failed'] as const).map((k) => `<tr><td class="start" style="font-weight:700">${{ average: 'المتوسط', passed: 'الناجحون', round2: 'الدور الثاني', failed: 'الراسبون' }[k]}</td>${d.subjects.map((s) => `<td class="num">${k === 'average' ? fmtMark(d.footer[s.id]?.average ?? null) : d.footer[s.id]?.[k] ?? 0}</td>`).join('')}</tr>`).join('')}</table>`
      : ''
    const top = `<div style="display:flex;justify-content:space-between;font-size:8.5px;margin-bottom:3px"><span>المراجِع: ........................ التاريخ: ............</span><span>الخانات الناقصة في الكشف: <b>${d.missing_cells}</b> | تمت مراجعة ...... من ${d.students.length}</span></div>`
    pages.push(`${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}${title(t)}${top}${blocks}${footer}
      ${signatureRow([['مدخل البيانات'], ['المراجِع'], ['منسق الامتحانات', x.examsCoordinator], ['مدير/ة المدرسة والختم', header.principal]])}${foot(`صفحة ${p + 1} من ${nPages}`)}`)
  }
  return doc(t, sheets(pages, { orientation: 'landscape' }), 'landscape', 8)
}

// ---- B6-20 second-round entry sheet ----------------------------------------------------------------

export function round2EntrySheetHtml(d: JgRound2EntrySheet, header: JgPrintHeader, settings: JgSettings): string {
  const t = `كشف رصد درجات الدور الثاني — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name} — ${yearOf(d.academic_year.name)}`
  const x = schoolExtras(settings)
  const headRows = `<tr><th rowspan="2">البيان</th>${d.subjects.map((s) => `<th colspan="3" style="font-size:7.5px">${esc(s.name)}</th>`).join('')}</tr><tr>${d.subjects.map(() => '<th style="font-size:7px">أعمال</th><th style="font-size:7px">امتحان</th><th style="font-size:7px">المجموع</th>').join('')}</tr>`
  const tri = (c: { works: number | null; exam: number | null; total: number | null } | undefined, shade: boolean) => {
    const bg = shade ? ' style="background:#E5E7EB"' : ''
    if (!c) return `<td${bg}></td><td${bg}></td><td${bg}></td>`
    return `<td class="num"${bg}>${fmtMark(c.works)}</td><td class="num"${bg}>${fmtMark(c.exam)}</td><td class="num"${bg} style="font-weight:700${shade ? ';background:#E5E7EB' : ''}">${fmtMark(c.total)}</td>`
  }
  const blocks = d.students
    .map((st, i) => {
      const shaded = new Set(st.round2_subjects)
      const rows = [
        ...d.stages.map((n) => `<tr><td class="start">${esc(d.stage_names[n - 1] ?? String(n))}</td>${d.subjects.map((s) => tri(st.stages[n]?.[s.id], shaded.has(s.id))).join('')}</tr>`),
        `<tr style="font-weight:700;background:var(--jg-blue-soft)"><td class="start">مجموع العام</td>${d.subjects.map((s) => tri(st.year[s.id], shaded.has(s.id))).join('')}</tr>`,
        `<tr><td class="start" style="font-weight:800">بعد الدور الثاني</td>${d.subjects.map((s) => (shaded.has(s.id) ? tri(st.after[s.id] ?? { works: st.year[s.id]?.works ?? null, exam: null, total: null }, true) : '<td></td><td></td><td></td>')).join('')}</tr>`,
      ].join('')
      return `<table style="margin-bottom:4px"><tr><td colspan="${d.subjects.length * 3 + 1}" class="start" style="font-weight:800;background:#F8FAFD">${i + 1}. ${esc(st.student.name)}</td></tr>${headRows}${rows}</table>`
    })
    .join('')
  const body = `${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}${title(t)}
    ${blocks || '<div class="muted" style="text-align:center;padding:10px">لا يوجد محالون للدور الثاني</div>'}
    <div class="muted" style="margin-top:3px">المواد المظللة بالرمادي: مواد الدور الثاني. درجة الأعمال تبقى كما هي، ويُرصد امتحان الدور الثاني مكان الامتحانات.</div>
    ${signatureRow([['معلم/ة المادة'], ['منسق الامتحانات', x.examsCoordinator], ['مدير/ة المدرسة', header.principal]])}${foot()}`
  return doc(t, sheet(body, { orientation: 'landscape' }, true), 'landscape', 8)
}

// ---- B6-18 second-round notices (2 per A4) ---------------------------------------------------------

const needText = (n: JgRound2Need) => (!n ? '' : n.kind === 'need' ? fmtMark(n.value) : n.kind === 'impossible' ? 'متعذر' : '')

export function round2NoticesHtml(d: JgRound2Notices, header: JgPrintHeader): string {
  const t = `إشعارات الدور الثاني — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name}`
  if (d.no_fail || !d.notices.length) {
    return doc(t, sheet(`${head(header, [])}${title(t)}<div style="text-align:center;padding:16px;font-size:12px">${d.no_fail ? 'لا دور ثاني في هذا الصف.' : 'لا يوجد محالون للدور الثاني.'}</div>${foot()}`, {}, true), 'portrait', 10)
  }
  const one = (n: JgRound2Notices['notices'][number]) => `<div>
    ${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}
    <div class="title">إشعار بدخول امتحان الدور الثاني — ${esc(n.student.name)}</div>
    <div style="margin:4px 0;font-size:10.5px">السيد/ة ولي أمر ${esc(n.learner)} / ${esc(n.student.name)} المحترم/ة،<br>${esc(n.greeting)}</div>
    <table style="font-size:10px"><tr><th>المادة</th><th>الدرجة المطلوبة للنجاح</th><th>الدرجة العظمى للامتحان</th><th>التاريخ واليوم</th><th>الوقت والمكان</th></tr>
      ${n.subjects.map((s) => `<tr><td style="font-weight:700">${esc(s.name)}</td><td class="num" style="font-weight:800">${esc(needText(s.need))}</td><td class="num">${fmtMark(s.exam_max)}</td><td>${esc([s.day, s.exam_date].filter(Boolean).join(' '))}</td><td>${esc([s.exam_time, s.place].filter(Boolean).join(' — '))}</td></tr>`).join('')}</table>
    <div class="muted" style="margin-top:3px">نرجو الحرص على حضور ${genderForm(n.student.gender ?? undefined, 'ابنكم', 'ابنتكم')} في الموعد، مع إحضار ما يلزم.</div>
    ${signatureRow([['رائد الفصل', header.homeroomTeacher], ['مدير/ة المدرسة (الختم)', header.principal], ['توقيع ولي الأمر']])}
  </div>`
  const pages: string[] = []
  for (let i = 0; i < d.notices.length; i += 2) {
    const a = d.notices[i]
    const b = d.notices[i + 1]
    pages.push(`${one(a)}${b ? `${cutLine}${one(b)}` : ''}${foot()}`)
  }
  return doc(t, sheets(pages), 'portrait', 9.5)
}

// ---- B6-27 guardian follow-up notices (2 per A4, tear-off slip) --------------------------------------

export function guardianNoticesHtml(d: JgGuardianNotices, header: JgPrintHeader): string {
  const t = `إشعار متابعة لولي الأمر — ${d.stage_name} — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name}`
  if (!d.notices.length) {
    return doc(t, sheet(`${head(header, [])}${title(t)}<div style="text-align:center;padding:16px;font-size:12px">لا يوجد ${d.grade_code <= 9 ? 'تلاميذ' : 'طلبة'} دون حد المتابعة في ${esc(d.stage_name)}.</div>${foot()}`, {}, true), 'portrait', 10)
  }
  const one = (n: JgGuardianNotices['notices'][number]) => `<div>
    ${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}
    <div class="title">إشعار متابعة لولي الأمر — ${esc(d.stage_name)}</div>
    <div style="margin:4px 0;font-size:10.5px">السيد/ة ولي أمر ${esc(n.learner)} / ${esc(n.student.name)} المحترم/ة،<br>نفيدكم بأن مستوى ${genderForm(n.student.gender ?? undefined, 'ابنكم', 'ابنتكم')} في المواد التالية دون حد المتابعة (${fmtPct(d.follow_rate)}):</div>
    <table style="font-size:10px"><tr><th>المادة</th><th>الدرجة</th><th>النسبة</th><th>التقدير</th><th>مقترح للمتابعة في البيت</th></tr>
      ${n.subjects.map((s) => `<tr><td style="font-weight:700">${esc(s.name)}</td><td class="num">${fmtMark(s.score)} / ${fmtMark(s.max)}</td><td class="num">${fmtPct(s.pct)}</td><td>${esc(s.estimate ?? '')}</td><td class="start">${esc(s.tip)}</td></tr>`).join('')}</table>
    <div style="margin-top:3px">نرجو متابعة ${genderForm(n.student.gender ?? undefined, 'ابنكم', 'ابنتكم')} في البيت والتواصل مع المدرسة.</div>
    ${signatureRow([['رائد الفصل', header.homeroomTeacher], ['مدير/ة المدرسة', header.principal]])}
    <div style="margin-top:4px;border-top:1px dashed #9AA8BF;padding-top:3px;font-size:9px">✂ إقرار ولي الأمر: اطلعتُ على مستوى ${esc(n.learner)} / ${esc(n.student.name)} وسأتابعه. الاسم: ................... التوقيع: ............ التاريخ: ........</div>
  </div>`
  const pages: string[] = []
  for (let i = 0; i < d.notices.length; i += 2) {
    const a = d.notices[i]
    const b = d.notices[i + 1]
    pages.push(`${one(a)}${b ? `${cutLine}${one(b)}` : ''}${foot()}`)
  }
  return doc(t, sheets(pages), 'portrait', 9.5)
}

// ---- B6-23 teacher's blank marking sheet -----------------------------------------------------------

export async function markingSheetsHtml(d: JgMarkingSheets, header: JgPrintHeader, settings: JgSettings): Promise<string> {
  const g = d.geometry
  const word = learnerWord(d.grade_code)
  const pages: string[] = []
  const x = schoolExtras(settings)
  for (const s of d.sheets) {
    const qr = await qrSvgOf(s.qr, 14)
    const chunks: (typeof d.students)[] = []
    for (let i = 0; i < Math.max(d.students.length, 1); i += g.rows_per_page) chunks.push(d.students.slice(i, i + g.rows_per_page))
    chunks.forEach((rows, ci) => {
      // Group header: one cell per component spanning its columns; thick lines at group edges.
      const groups: { label: string; span: number }[] = []
      for (const c of s.columns) {
        const last = groups[groups.length - 1]
        if (last && last.label === c.group_label) last.span++
        else groups.push({ label: c.group_label, span: 1 })
      }
      const edge = (k: number) => (k === s.columns.length - 1 || s.columns[k + 1].group !== s.columns[k].group ? 'border-inline-end:2px solid var(--jg-navy);' : '')
      const colW = `width:${g.mark_mm}mm;min-width:${g.mark_mm}mm;max-width:${g.mark_mm}mm;`
      const thead = `<tr><th rowspan="2" style="width:${g.serial_mm}mm">م</th><th rowspan="2" style="width:${g.name_mm}mm">اسم ${esc(word)}/ـة</th><th rowspan="2" style="width:${g.reg_mm}mm">رقم القيد</th>${groups
        .map((gr) => `<th colspan="${gr.span}" style="font-size:7.5px;border-inline-end:2px solid #fff">${esc(gr.label)}</th>`)
        .join('')}${s.notes_column ? `<th rowspan="2" style="width:${g.notes_mm}mm">ملاحظات</th>` : ''}</tr>
        <tr>${s.columns.map((c, k) => `<th style="${colW}${edge(k)}font-size:6.5px;background:var(--jg-blue);line-height:1.1">${esc(c.kind === 'component' || c.kind === 'exam' ? (c.kind === 'exam' ? 'امتحان' : 'الدرجة') : c.label)}${c.max !== null ? `<br>(${fmtMark(c.max)})` : ''}</th>`).join('')}</tr>`
      const body = rows
        .map((r) => `<tr style="height:${g.row_mm}mm"><td class="num">${r.list_number}</td><td class="start" style="font-size:8.5px">${esc(r.student.name)}</td><td class="num" style="font-size:8px">${esc(r.registration_number ?? '')}</td>${s.columns.map((_, k) => `<td style="${colW}${edge(k)}"></td>`).join('')}${s.notes_column ? '<td></td>' : ''}</tr>`)
        .join('')
      const pageLabel = [s.pages > 1 ? `الجزء ${s.page} من ${s.pages}` : '', chunks.length > 1 ? `صفحة ${ci + 1} من ${chunks.length}` : ''].filter(Boolean).join(' — ')
      pages.push(`<div style="display:flex;align-items:flex-start;gap:6px">
          <div style="flex:1">${head(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name], ['المادة', s.subject_name], ['الفترة', s.stage_name]])}</div>
          <div style="flex:0 0 auto;text-align:center">${qr}<div class="num" style="font-size:6px">${esc(s.qr)}</div></div></div>
        <div class="title">كشف رصد المعلم — ${esc(s.subject_name)} — ${esc(s.stage_name)}</div>
        <table style="table-layout:fixed">${thead}${body}</table>
        ${signatureRow([['معلم/ة المادة'], ['رائد الفصل', header.homeroomTeacher], ['منسق الامتحانات', x.examsCoordinator]])}${foot(pageLabel)}`)
    })
  }
  // Fixed geometry: never scaled (grow 1 and the content is sized in mm to fit), so a photo can be read back.
  return doc('كشف رصد المعلم', sheets(pages), 'portrait', 9)
}

// ---- renderers -----------------------------------------------------------------------------------

export const renderStatisticsPdf = (d: JgStatistics, h: JgPrintHeader, s: JgSettings) => pdf(statisticsHtml(d, h, s), true)
export const renderTopStudentsPdf = (d: JgTopStudents, h: JgPrintHeader) => pdf(topStudentsHtml(d, h))
export const renderFinalSheetPdf = (d: JgFinalSheet, h: JgPrintHeader, s: JgSettings) => pdf(finalSheetHtml(d, h, s), true)
export const renderReviewSheetPdf = (d: JgReviewSheet, h: JgPrintHeader, s: JgSettings) => pdf(reviewSheetHtml(d, h, s), true)
export const renderRound2EntrySheetPdf = (d: JgRound2EntrySheet, h: JgPrintHeader, s: JgSettings) => pdf(round2EntrySheetHtml(d, h, s), true)
export const renderRound2NoticesPdf = (d: JgRound2Notices, h: JgPrintHeader) => pdf(round2NoticesHtml(d, h))
export const renderGuardianNoticesPdf = (d: JgGuardianNotices, h: JgPrintHeader) => pdf(guardianNoticesHtml(d, h))
export const renderMarkingSheetsPdf = async (d: JgMarkingSheets, h: JgPrintHeader, s: JgSettings) => pdf(await markingSheetsHtml(d, h, s))

