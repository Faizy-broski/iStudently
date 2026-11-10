import { fmtMark, fmtPct } from '../../lib/jahbadh'
import { escapeHtml as esc, renderHtmlToPdf } from '../../utils/html-pdf.util'
import type { JgMonthlyCards, JgMonthlyCurve } from './official.service'
import { footHtml, officialHeaderHtml, page, type JgPrintHeader } from './print.service'
import { cutLine, FIT_SCRIPT, sheets, signatureRow } from './print-layout'

/** «الصحيفة الشهرية» (2 per A4) and «المنحنى الشهري» (brief B6-21; workbook sheets of the same names). */

const yearOf = (name: string | null) => (name ? `${name} م` : '')
const trendHtml = (t: string | null) =>
  t === '▲' ? '<span style="color:var(--jg-success)">▲</span>' : t === '▼' ? '<span style="color:var(--jg-danger)">▼</span>' : t === '●' ? '<span class="muted">●</span>' : ''

export function monthlyCardsHtml(d: JgMonthlyCards, header: JgPrintHeader): string {
  const one = (c: JgMonthlyCards['cards'][number]) => `<div>
    ${officialHeaderHtml(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}
    <div class="title">الصحيفة الشهرية — شهر ${esc(d.month_name)} — ${esc(d.stage_name)}</div>
    <div style="margin:3px 0;font-size:10.5px">${d.grade_code > 9 ? 'الطالب/ـة' : 'التلميذ/ـة'}: <b>${esc(c.student.name)}</b> <span class="muted">— رقم ${c.list_number}</span></div>
    <table style="font-size:10px"><tr><th style="width:18px">م</th><th>المادة</th><th>العظمى</th><th>درجة الشهر</th><th>التقدير</th><th>الشهر السابق</th><th>التقدم</th><th style="width:22%">ملاحظة</th></tr>
      ${c.subjects
        .map((s, i) => `<tr><td class="num">${i + 1}</td><td class="start" style="font-weight:700">${esc(s.name)}</td><td class="num">${fmtMark(s.max)}</td><td class="num" style="font-weight:800">${s.absent ? 'غ' : s.mark === null ? '—' : fmtMark(s.mark)}</td><td>${esc(s.estimate ?? '')}</td><td class="num">${s.previous === null ? '—' : fmtMark(s.previous)}</td><td>${trendHtml(s.trend)}</td><td></td></tr>`)
        .join('')}
      <tr style="background:var(--jg-blue-soft);font-weight:800"><td colspan="3" class="start">المستوى العام للشهر</td><td class="num">${c.total === null ? '—' : `${fmtMark(c.total)} / ${fmtMark(c.max)}`}</td><td>${esc(c.level ?? '')}</td><td colspan="3" class="start">أيام الغياب في الشهر: ${c.absence_days === null ? '........' : `<b class="num">${c.absence_days}</b>`} ${c.pct === null ? '' : `<span class="muted">(${fmtPct(c.pct)})</span>`}</td></tr></table>
    <div style="margin-top:4px">ملاحظة المعلم: ...........................................................................................</div>
    ${signatureRow([['رائد الفصل', header.homeroomTeacher], ['توقيع ولي الأمر']])}
  </div>`
  const t = `الصحيفة الشهرية — ${d.month_name} — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name}`
  if (!d.cards.length) return page(t, sheets([`<div class="title">${esc(t)}</div><div class="muted" style="text-align:center">لا يوجد ${d.grade_code > 9 ? 'طلبة' : 'تلاميذ'} في هذا النطاق</div>`]) + FIT_SCRIPT, 'portrait', 10)
  const pages: string[] = []
  for (let i = 0; i < d.cards.length; i += 2) {
    const b = d.cards[i + 1]
    pages.push(`${one(d.cards[i])}${b ? `${cutLine}${one(b)}` : ''}${footHtml('', { brand: false })}`)
  }
  return page(t, sheets(pages) + FIT_SCRIPT, 'portrait', 9.5)
}

/** One row per subject: a % bar per month in use, then the trend. One A4 landscape page per student. */
export function monthlyCurveHtml(d: JgMonthlyCurve, header: JgPrintHeader): string {
  const t = `المنحنى الشهري — الصف ${d.section.grade_level_name} — الشعبة ${d.section.name}`
  const bar = (p: number | null) =>
    p === null
      ? '<span class="muted">—</span>'
      : `<div style="height:22px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center"><div style="width:60%;height:${Math.max(2, Math.round(p * 18))}px;background:${p >= 0.85 ? 'var(--jg-success)' : p >= 0.5 ? 'var(--jg-royal)' : 'var(--jg-danger)'};border-radius:2px"></div><div class="num" style="font-size:7px">${fmtPct(p)}</div></div>`
  const pages = d.students.map((st) => `${officialHeaderHtml(header, [['العام الدراسي', yearOf(d.academic_year.name)], ['الصف', d.section.grade_level_name], ['الشعبة', d.section.name]])}
    <div class="title">المنحنى الشهري — ${esc(st.student.name)}</div>
    <table><tr><th>المادة</th>${d.months.map((m) => `<th style="font-size:7.5px">${esc(m.name)}<br><span style="font-weight:400">${esc(d.stage_names[m.stage - 1] ?? '')}</span></th>`).join('')}<th>الاتجاه</th></tr>
      ${st.subjects.map((s) => `<tr><td class="start" style="font-weight:700">${esc(s.name)}</td>${s.points.map((p) => `<td>${bar(p)}</td>`).join('')}<td>${trendHtml(s.trend)}</td></tr>`).join('')}
      <tr style="background:var(--jg-blue-soft);font-weight:800"><td class="start">المستوى العام</td>${st.overall.map((p) => `<td>${bar(p)}</td>`).join('')}<td></td></tr></table>
    ${footHtml('', { brand: false })}`)
  return page(t, sheets(pages.length ? pages : [`<div class="title">${esc(t)}</div>`], { orientation: 'landscape', grow: 1.2 }) + FIT_SCRIPT, 'landscape', 9)
}

export const renderMonthlyCardsPdf = (d: JgMonthlyCards, h: JgPrintHeader) => renderHtmlToPdf(monthlyCardsHtml(d, h), { margin: { top: '0', bottom: '0' } })
export const renderMonthlyCurvePdf = (d: JgMonthlyCurve, h: JgPrintHeader) => renderHtmlToPdf(monthlyCurveHtml(d, h), { landscape: true, margin: { top: '0', bottom: '0' } })
