import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { supabase } from '../../config/supabase'
import { decisionTone, fmtMark, fmtPct, genderForm, learnerWord, type JgRound2Need } from '../../lib/jahbadh'
import { escapeHtml as esc, renderHtmlToPdf } from '../../utils/html-pdf.util'
import type { JgResults, JgSecondRound, JgSettings } from './grades.service'

/**
 * Printed documents of the Jahbadh grades plugin: A4 HTML rendered by the shared headless Chromium
 * (utils/html-pdf.util.ts). Arabic shaping and RTL come from Chromium; the Cairo font is embedded
 * (backend/assets/fonts, OFL) so the output is the same on every server.
 *
 * The Jahbadh brand palette is defined ONCE here as print tokens (brief A2: printed documents may
 * use it); screens use the app's theme tokens.
 */

let fontCss: string | null = null
function embeddedFontCss(): string {
  if (fontCss !== null) return fontCss
  try {
    const file = resolve(__dirname, '../../../assets/fonts/Cairo-Variable.ttf')
    const b64 = readFileSync(file).toString('base64')
    fontCss = `@font-face{font-family:'Cairo';src:url(data:font/ttf;base64,${b64}) format('truetype');font-weight:200 1000;font-style:normal;}`
  } catch (err) {
    console.error('Cairo font not found; PDFs fall back to system Arabic fonts', err)
    fontCss = ''
  }
  return fontCss
}

const PRINT_TOKENS = `
:root{
  --jg-navy:#0C285C; --jg-royal:#1548A0; --jg-blue:#256ED6; --jg-gold:#F4B41A;
  --jg-gold-soft:#FFF4D6; --jg-blue-soft:#E8F0FB; --jg-line:#B9C8E4; --jg-ink:#1B2433; --jg-muted:#5B6B82;
  --jg-success:#1F7A3A; --jg-success-soft:#E3F4E8; --jg-warning:#B4550A; --jg-warning-soft:#FDEBD8;
  --jg-danger:#B42318; --jg-danger-soft:#FDE4E2; --jg-teal:#0F7C7C; --jg-purple:#7A3EA8; --jg-purple-soft:#F2EAF8;
}`

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Cairo','Noto Sans Arabic',Tahoma,Arial,sans-serif;color:var(--jg-ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-size:9px;line-height:1.35}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid var(--jg-line);padding:2px 3px;text-align:center;vertical-align:middle}
th{background:var(--jg-navy);color:#fff;font-weight:700}
.num{font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}
.start{text-align:start}
.muted{color:var(--jg-muted)}
.band{background:linear-gradient(135deg,var(--jg-navy),var(--jg-royal));color:#fff;border-bottom:3px solid var(--jg-gold);display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px 6px 0 0}
.band .brand{font-weight:800;font-size:15px;line-height:1}
.band .tag{font-size:8px;color:var(--jg-gold)}
.band .grow{flex:1}
.title{background:var(--jg-navy);color:#fff;text-align:center;font-weight:800;font-size:12px;padding:4px;border-radius:4px;margin:4px 0}
.lines{text-align:center;font-weight:700;color:var(--jg-navy)}
.lines .school{font-size:12px;color:var(--jg-royal)}
.foot{margin-top:6px;border-top:2px solid var(--jg-gold);padding-top:3px;display:flex;justify-content:space-between;font-size:7.5px;color:var(--jg-muted)}
.sign{display:flex;justify-content:space-between;gap:16px;margin-top:8px;font-size:9px}
.sign div{flex:1}
.chip{display:inline-block;border-radius:8px;padding:0 5px;font-weight:700}
.t-success{background:var(--jg-success-soft);color:var(--jg-success)}
.t-warning{background:var(--jg-warning-soft);color:var(--jg-warning)}
.t-destructive{background:var(--jg-danger-soft);color:var(--jg-danger)}
.t-muted{background:#EEF1F5;color:var(--jg-muted)}
`

/** The approved app icon: rounded blue square, white «ج», gold dot. */
export const JAHBADH_LOGO_SVG = `<svg width="30" height="30" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="jg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#256ED6"/><stop offset="1" stop-color="#1548A0"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#jg)"/><text x="32" y="45" text-anchor="middle" font-family="Cairo,Tahoma" font-weight="900" font-size="38" fill="#fff">ج</text><circle cx="44" cy="17" r="5" fill="#F4B41A"/></svg>`

const JAHBADH_FOOTER = 'جهبذ للخدمات التعليمية والتطبيقات والوسائل التفاعلية — www.jahbadh.com'

export interface JgPrintHeader {
  schoolName: string
  logoUrl: string | null
  educationOffice: string
  municipality: string
  principal: string
  homeroomTeacher: string
}

export async function printHeader(schoolId: string, settings: JgSettings): Promise<JgPrintHeader> {
  const { data } = await supabase.from('schools').select('name, logo_url').eq('id', schoolId).maybeSingle()
  const h = settings.header ?? {}
  return {
    schoolName: h.school_name || data?.name || '',
    logoUrl: h.logo_url || data?.logo_url || null,
    educationOffice: h.education_office || '',
    municipality: h.municipality || '',
    principal: h.principal || '',
    homeroomTeacher: h.homeroom_teacher || '',
  }
}

export function page(title: string, body: string, orientation: 'portrait' | 'landscape', fontPx = 9) {
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${embeddedFontCss()}${PRINT_TOKENS}${BASE_CSS}
@page{size:A4 ${orientation};margin:8mm}
body{font-size:${fontPx}px}
</style></head><body>${body}</body></html>`
}

export function bandHtml(header: JgPrintHeader, subtitle = 'منظومة رصد الدرجات') {
  const logo = header.logoUrl ? `<img src="${esc(header.logoUrl)}" style="height:30px;max-width:60px;object-fit:contain;background:#fff;border-radius:4px;padding:1px">` : ''
  return `<div class="band">${JAHBADH_LOGO_SVG}<div><div class="brand">جهبذ</div><div class="tag">${esc(subtitle)}</div></div>
    <div class="grow lines" style="color:#fff">
      <div style="font-size:8.5px;opacity:.9">دولة ليبيا • وزارة التربية والتعليم${header.educationOffice ? ` • ${esc(header.educationOffice)}` : ''}${header.municipality ? ` — بلدية ${esc(header.municipality)}` : ''}</div>
      <div style="font-size:12px;font-weight:800">${esc(header.schoolName)}</div>
    </div>${logo}</div>`
}

export const footHtml = (pageLabel = '') => `<div class="foot"><span>${esc(JAHBADH_FOOTER)}</span><span>${esc(pageLabel)}</span></div>`

const signaturesHtml = (header: JgPrintHeader) => `<div class="sign">
  <div>المعلم/ـة أو رائد الفصل : ${esc(header.homeroomTeacher)}<br><span class="muted">التوقيع : ..................</span></div>
  <div>مدير/ة المدرسة : ${esc(header.principal)}<br><span class="muted">التوقيع والختم : ..................</span></div>
</div>`

const yearLabel = (name: string | null) => (name ? `${name} م` : '')

// ---- results sheet ---------------------------------------------------------------------------------

export function resultsSheetHtml(r: JgResults, header: JgPrintHeader): string {
  const title = `النتائج النهائية — الصف ${r.section.grade_level_name} — الشعبة ${r.section.name} — العام ${yearLabel(r.academic_year.name)}`
  const word = learnerWord(r.rule.grade_code)
  const head = `<tr><th style="width:18px">رقم</th><th style="min-width:120px">اسم ${esc(word)}/ـة</th>${r.subjects
    .map((s) => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:70px;font-size:8px">${esc(s.short_name)}</th>`)
    .join('')}<th>المجموع العام</th><th>النسبة</th><th>التقدير</th><th>الترتيب</th><th>مواد الدور الثاني / تحتاج دعماً</th><th style="min-width:110px">القرار</th></tr>`
  const maxRow = `<tr style="background:var(--jg-gold);font-weight:800"><td></td><td>الدرجة العظمى</td>${r.subjects
    .map((s) => `<td class="num">${fmtMark(s.subject_max)}</td>`)
    .join('')}<td class="num">${fmtMark(r.grand_max)}</td><td colspan="5"></td></tr>`
  const rows = r.students
    .map((st, i) => {
      const tone = decisionTone(st.decision)
      return `<tr><td class="num">${i + 1}</td><td class="start">${esc(st.student.name)}</td>${r.subjects
        .map((s) => {
          const res = st.subjects[s.id].result
          const t = res.result === 'round2' || res.result === 'fail' ? ` class="t-${res.result === 'fail' ? 'destructive' : 'warning'}"` : ''
          return `<td${t}><span class="num">${fmtMark(res.final)}</span></td>`
        })
        .join('')}<td class="num" style="font-weight:700">${fmtMark(st.total)}</td><td class="num">${fmtPct(st.pct, 1)}</td><td>${esc(st.estimate ?? '')}</td><td class="num">${st.rank ?? ''}</td><td class="start" style="font-size:8px">${esc(st.support_subjects.join('، '))}</td><td><span class="chip t-${tone}">${esc(st.decision)}</span></td></tr>`
    })
    .join('')
  return page(
    title,
    `${bandHtml(header)}<div class="title">${esc(title)}</div>
     <table>${head}${maxRow}${rows}</table>
     <div class="muted" style="margin-top:4px">${esc(r.rule.rule_text)}</div>
     ${signaturesHtml(header)}${footHtml()}`,
    'landscape',
  )
}

// ---- second round ----------------------------------------------------------------------------------

function needCell(n: JgRound2Need): { text: string; cls: string } {
  if (!n) return { text: '', cls: '' }
  if (n.kind === 'need') return { text: `≥ ${fmtMark(n.value)}`, cls: 't-warning' }
  if (n.kind === 'impossible') return { text: 'متعذر', cls: 't-destructive' }
  if (n.kind === 'passed') return { text: `✓ ${fmtMark(n.value)}`, cls: 't-success' }
  return { text: `✗ ${fmtMark(n.value)}`, cls: 't-destructive' }
}

export function secondRoundHtml(r: JgSecondRound, header: JgPrintHeader): string {
  const title = `الراسبون والدور الثاني — الصف ${r.section.grade_level_name} — الشعبة ${r.section.name} — ${yearLabel(r.academic_year.name)}`
  const word = learnerWord(r.rule.grade_code)
  if (r.no_fail) {
    return page(title, `${bandHtml(header)}<div class="title">${esc(title)}</div>
      <div style="padding:14px;text-align:center;font-size:12px;background:var(--jg-gold-soft);border-radius:6px;margin-top:8px">
      الصف ${esc(r.section.grade_level_name)}: لا رسوب ولا دور ثاني في هذا الصف، وينقل ${esc(word)} إلى الصف التالي حسب مستواه.</div>${footHtml()}`, 'landscape')
  }
  const tile = (label: string, value: string, tone: string) =>
    `<td style="width:16.6%"><div style="font-size:8px;font-weight:700" class="t-${tone}">${esc(label)}</div><div class="num" style="font-size:16px;font-weight:800">${esc(value)}</div></td>`
  const t = r.tiles
  const tiles = `<table style="margin-bottom:6px"><tr>
    ${tile('المحالون للدور الثاني', String(t.referred), 'warning')}
    ${tile('بانتظار رصد الدور الثاني', String(t.awaiting), 'muted')}
    ${tile('نجحوا بعد الدور الثاني', String(t.passed_after), 'success')}
    ${tile('راسبون', String(t.failed), 'destructive')}
    ${tile('نسبة النجاح في الدور الثاني', t.pass_rate === null ? '—' : fmtPct(t.pass_rate), 'muted')}
    ${tile('المادة الأكثر إحالة', t.top_subject ?? '—', 'muted')}</tr></table>`
  const subjHead = `<tr><th>المادة</th>${r.subjects.map((s) => `<th style="font-size:8px">${esc(s.short_name)}</th>`).join('')}<th>المجموع</th></tr>`
  const line = (label: string, key: 'referred' | 'awaiting' | 'passed_after' | 'failed') =>
    `<tr><td class="start" style="font-weight:700">${label}</td>${r.per_subject.map((p) => `<td class="num">${p[key] || ''}</td>`).join('')}<td class="num" style="font-weight:800">${r.per_subject.reduce((a, p) => a + p[key], 0)}</td></tr>`
  const summary = `<table style="margin-bottom:6px">${subjHead}${line('المحالون للدور الثاني', 'referred')}${line('بانتظار الرصد', 'awaiting')}${line('نجحوا بعد الدور الثاني', 'passed_after')}${line('رسبوا', 'failed')}</table>`
  const listHead = `<tr><th style="width:18px">رقم</th><th>اسم ${esc(word)}/ـة</th>${r.subjects.map((s) => `<th style="font-size:8px">${esc(s.short_name)}</th>`).join('')}<th>عدد المواد</th><th>القرار</th></tr>`
  const listRows = r.students
    .map((st, i) => `<tr><td class="num">${i + 1}</td><td class="start">${esc(st.student.name)}</td>${r.subjects
      .map((s) => {
        const c = needCell(st.cells[s.id] ?? null)
        return `<td class="${c.cls}"><span class="num">${esc(c.text)}</span></td>`
      })
      .join('')}<td class="num">${st.subject_count}</td><td><span class="chip t-${decisionTone(st.decision)}">${esc(st.decision)}</span></td></tr>`)
    .join('')
  const legend = `<div class="muted" style="margin-top:4px;border:1px solid var(--jg-line);padding:3px;border-radius:4px">مفتاح القراءة: ≥ رقم = الدرجة المطلوبة في امتحان الدور الثاني | ✓ رقم = نجح ودرجته في الدور الثاني | ✗ رقم = رسب في الدور الثاني | متعذر = لا تكفي الدرجة الكاملة للنجاح</div>`
  return page(
    title,
    `${bandHtml(header)}<div class="title">${esc(title)}</div>${tiles}${summary}
     <table>${listHead}${listRows || `<tr><td colspan="${r.subjects.length + 4}" class="muted">لا يوجد محالون للدور الثاني</td></tr>`}</table>
     ${legend}${signaturesHtml(header)}${footHtml()}`,
    'landscape',
  )
}

export const renderResultsPdf = (r: JgResults, header: JgPrintHeader) => renderHtmlToPdf(resultsSheetHtml(r, header), { landscape: true, margin: { top: '0', bottom: '0' } })
export const renderSecondRoundPdf = (r: JgSecondRound, header: JgPrintHeader) => renderHtmlToPdf(secondRoundHtml(r, header), { landscape: true, margin: { top: '0', bottom: '0' } })

// ---- report card (B7) ------------------------------------------------------------------------------

export interface JgReportCardOptions {
  rank: boolean
  minPass: boolean
  subjectEstimate: boolean
  classAverage: boolean
  performanceBar: boolean
  trend: boolean
  badges: boolean
  insight: boolean
  activities: boolean
  attendance: boolean
  guardianTips: boolean
  quote: boolean
}

export const JG_REPORT_CARD_ALL_ON: JgReportCardOptions = {
  rank: true, minPass: true, subjectEstimate: true, classAverage: true, performanceBar: true, trend: true,
  badges: true, insight: true, activities: true, attendance: true, guardianTips: true, quote: true,
}

export interface JgReportCardSubject {
  name: string
  weeklyPeriods: number
  /** Per stage: coursework, exam, total (null = not entered). */
  stages: { works: number | null; exam: number | null; total: number | null; max: number }[]
  max: number
  /** null in no-fail grades. */
  minPass: number | null
  final: number | null
  round2: number | null
  pct: number | null
  estimate: string | null
  classAverage: number | null
  /** Change between the first two stages, in percentage points. */
  trend: number | null
}

export interface JgReportCardData {
  header: JgPrintHeader
  title: string
  yearName: string
  gradeCode: number
  gradeName: string
  sectionName: string
  systemName: string
  stageNames: string[]
  ruleText: string
  student: {
    name: string
    gender: string | null
    nationality: string
    registrationNumber: string
    motherName: string
    birth: string
    listNumber: number
  }
  subjects: JgReportCardSubject[]
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  rank: number | null
  classSize: number
  decision: string
  /** Second-round column: final-year cards of grades that have a second round (default true). */
  showRound2?: boolean
  activities: { name: string; levels: (string | null)[] }[]
  attendance: { excused: (number | null)[]; unexcused: (number | null)[]; schoolDays: (number | null)[] }
  notes: (string | null)[]
  guardianTips: string[]
  quote: string
  excelRate: number
  followRate: number
}

const bar = (pct: number | null) => {
  if (pct === null) return ''
  const filled = Math.max(0, Math.min(5, Math.round(pct * 5)))
  return `<span style="letter-spacing:-1px;color:var(--jg-royal)">${'■'.repeat(filled)}</span><span style="letter-spacing:-1px;color:var(--jg-line)">${'■'.repeat(5 - filled)}</span>`
}
const trendMark = (t: number | null) => {
  if (t === null) return ''
  if (t > 1) return '<span style="color:var(--jg-success)">▲</span>'
  if (t < -1) return '<span style="color:var(--jg-danger)">▼</span>'
  return '<span class="muted">●</span>'
}

function badgeFor(d: JgReportCardData): string | null {
  const g = d.student.gender
  if (d.rank !== null && d.rank <= 3) return `🏆 من أوائل الفصل — ${genderForm(g, d.gradeCode <= 9 ? 'التلميذ المتميز' : 'الطالب المتميز', d.gradeCode <= 9 ? 'التلميذة المتميزة' : 'الطالبة المتميزة')} 🏆`
  if (d.pct !== null && d.pct >= d.excelRate) return '⭐ وسام التميّز الدراسي ⭐'
  const trends = d.subjects.map((s) => s.trend).filter((t): t is number => t !== null)
  const avgTrend = trends.length ? trends.reduce((a, b) => a + b, 0) / trends.length : 0
  if (d.stageNames.length > 1 && avgTrend > 5) return '🚀 وسام الأداء المتصاعد 🚀'
  if (d.pct !== null && d.pct >= 0.75) return '🌟 أداء مشرّف — استمر 🌟'
  return null
}

function insightLines(d: JgReportCardData): [string, string] | null {
  const ranked = d.subjects.filter((s) => s.pct !== null).sort((a, b) => b.pct! - a.pct!)
  if (!ranked.length || d.pct === null) return null
  const best = ranked[0]
  const weak = ranked[ranked.length - 1]
  const trends = d.subjects.map((s) => s.trend).filter((t): t is number => t !== null)
  const change = trends.length ? trends.reduce((a, b) => a + b, 0) / trends.length : null
  const g = d.student.gender
  // Numbers with signs/percent are isolated (LRI … PDI) so they don't flip inside Arabic text.
  const iso = (t: string) => `\u2066${t}\u2069`
  const line1 = `💪 نقطة القوة: ${best.name} (${iso(fmtPct(best.pct))})   🎯 تحتاج إلى تعزيز: ${weak.name} (${iso(fmtPct(weak.pct))})${
    change !== null && d.stageNames.length > 1 ? `   📈 التغير بين ${d.stageNames[0]} و${d.stageNames[1]}: ${iso(`${change >= 0 ? '+' : ''}${Math.round(change * 10) / 10}%`)}` : ''
  }`
  const who = genderForm(g, d.gradeCode <= 9 ? 'التلميذ' : 'الطالب', d.gradeCode <= 9 ? 'التلميذة' : 'الطالبة')
  let line2: string
  if (d.pct >= d.excelRate) line2 = `${who} ${genderForm(g, 'يحقق', 'تحقق')} أداءً ممتازاً ومرتفعاً، ويُوصى بمسار إثرائي وتحديات أعلى ${genderForm(g, 'له', 'لها')}.`
  else if (d.pct >= 0.65) line2 = `أداء جيد، و${genderForm(g, 'يستطيع', 'تستطيع')} بلوغ التميّز بمزيد من التدريب في ${weak.name}.`
  else if (d.pct >= d.followRate) line2 = `أداء مقبول ${genderForm(g, 'يحتاج', 'تحتاج')} فيه إلى متابعة منزلية منتظمة، خاصة في ${weak.name}.`
  else line2 = `${genderForm(g, 'يحتاج', 'تحتاج')} إلى خطة دعم عاجلة بالتعاون بين المدرسة والأسرة، بدءاً بمادة ${weak.name}.`
  return [line1, line2]
}

/** The card itself (one A4 page), without the document wrapper. */
export function reportCardBody(d: JgReportCardData, o: JgReportCardOptions = JG_REPORT_CARD_ALL_ON): string {
  const word = learnerWord(d.gradeCode, d.student.gender)
  const stages = d.stageNames
  const stageCols = stages.length
  const extraCols = [
    o.minPass && 'الصغرى',
    'الدرجة النهائية',
    d.showRound2 !== false && 'الدور الثاني',
    o.subjectEstimate && 'التقدير',
    o.classAverage && 'متوسط الصف',
    o.performanceBar && 'مستوى الأداء',
    o.trend && 'التقدم',
  ].filter(Boolean) as string[]

  const head1 = `<tr><th rowspan="2" style="min-width:92px">المواد الدراسية المقررة</th><th rowspan="2" style="width:16px;font-size:7px">الحصص</th>${stages
    .map((s) => `<th colspan="3" style="background:var(--jg-royal)">${esc(s)}</th>`)
    .join('')}<th rowspan="2">الكبرى</th>${extraCols.map((c) => `<th rowspan="2" style="font-size:7.5px">${esc(c)}</th>`).join('')}</tr>`
  const head2 = `<tr>${stages.map(() => '<th style="background:var(--jg-blue);font-size:7px">أعمال</th><th style="background:var(--jg-blue);font-size:7px">امتحان</th><th style="background:var(--jg-blue);font-size:7px">المجموع</th>').join('')}</tr>`
  const subjectRows = d.subjects
    .map((s, i) => {
      const cells = s.stages
        .map((st) =>
          st.max === 0
            ? '<td class="muted">—</td><td class="muted">—</td><td class="muted" style="background:var(--jg-blue-soft)">—</td>'
            : `<td class="num">${fmtMark(st.works)}</td><td class="num">${fmtMark(st.exam)}</td><td class="num" style="font-weight:700;background:var(--jg-blue-soft)">${fmtMark(st.total)}</td>`,
        )
        .join('')
      const extras = [
        o.minPass && `<td class="num muted">${s.minPass === null ? '—' : fmtMark(s.minPass)}</td>`,
        `<td class="num" style="font-weight:800;background:var(--jg-gold-soft)">${fmtMark(s.final)}</td>`,
        d.showRound2 !== false && `<td class="num">${s.round2 === null ? '—' : fmtMark(s.round2)}</td>`,
        o.subjectEstimate && `<td>${esc(s.estimate ?? '')}</td>`,
        o.classAverage && `<td class="num muted">${fmtMark(s.classAverage)}</td>`,
        o.performanceBar && `<td style="font-size:8px">${bar(s.pct)}</td>`,
        o.trend && `<td>${trendMark(s.trend)}</td>`,
      ].filter(Boolean).join('')
      return `<tr style="${i % 2 ? 'background:#F8FAFD' : ''}"><td class="start" style="font-weight:700">${esc(s.name)}</td><td class="num">${s.weeklyPeriods}</td>${cells}<td class="num">${fmtMark(s.max)}</td>${extras}</tr>`
    })
    .join('')
  const sumStage = (k: number) => d.subjects.reduce((a, s) => a + (s.stages[k]?.total ?? 0), 0)
  const totalRow = `<tr style="background:var(--jg-navy);color:#fff;font-weight:800"><td class="start" style="color:var(--jg-gold)">المجمـــوع</td><td class="num">${d.subjects.reduce((a, s) => a + s.weeklyPeriods, 0)}</td>${stages
    .map((_, k) => `<td colspan="3" class="num">${fmtMark(sumStage(k))}</td>`)
    .join('')}<td class="num">${fmtMark(d.max)}</td><td colspan="${extraCols.length}" class="num">${fmtMark(d.total)}</td></tr>`

  const tone = decisionTone(d.decision)
  const tile = (label: string, value: string, extra = '') =>
    `<td><div style="font-size:7.5px;color:#fff;background:var(--jg-teal);margin:-2px -3px 2px;padding:1px">${esc(label)}</div><div style="font-size:11px;font-weight:800${extra}">${value}</div></td>`
  const tiles = `<table style="margin-top:4px"><tr>
    ${tile('المجموع العام', `<span class="num">${fmtMark(d.total)}</span> من <span class="num">${fmtMark(d.max)}</span>`)}
    ${tile('النسبة المئوية', `<span class="num">${fmtPct(d.pct, 1)}</span>`)}
    ${tile('التقدير العام', esc(d.estimate ?? ''))}
    ${o.rank ? tile('الترتيب في الفصل', `<span class="num">${d.rank ?? '—'}</span> من <span class="num">${d.classSize}</span>`) : ''}
    ${tile('القرار', `<span class="chip t-${tone}">${esc(d.decision)}</span>`)}
  </tr></table>`

  const badge = o.badges ? badgeFor(d) : null
  const stageHead = stages.map((s) => `<th style="background:var(--jg-purple-soft);color:var(--jg-purple);font-size:7.5px">${esc(s)}</th>`).join('')
  const activities = o.activities
    ? `<table><tr><th colspan="${stageCols + 1}" style="background:var(--jg-purple)">🎨 مواد النشاط (تقدير لفظي)</th></tr><tr><th style="background:var(--jg-purple-soft);color:var(--jg-purple)">المادة</th>${stageHead}</tr>${d.activities
        .map((a) => `<tr><td class="start">${esc(a.name)}</td>${stages.map((_, k) => `<td>${esc(a.levels[k] ?? '')}</td>`).join('')}</tr>`)
        .join('')}</table>`
    : ''
  const attPct = (k: number) => {
    const days = d.attendance.schoolDays[k]
    if (!days) return ''
    const abs = (d.attendance.excused[k] ?? 0) + (d.attendance.unexcused[k] ?? 0)
    return fmtPct((days - abs) / days)
  }
  const attendance = o.attendance
    ? `<table><tr><th colspan="${stageCols + 1}" style="background:var(--jg-purple)">📅 الحضور والغياب</th></tr><tr><th style="background:var(--jg-purple-soft);color:var(--jg-purple)">البيان</th>${stageHead}</tr>
      <tr><td class="start">غياب مشروع (أيام)</td>${stages.map((_, k) => `<td class="num">${d.attendance.excused[k] ?? ''}</td>`).join('')}</tr>
      <tr><td class="start">غياب غير مشروع (أيام)</td>${stages.map((_, k) => `<td class="num">${d.attendance.unexcused[k] ?? ''}</td>`).join('')}</tr>
      <tr><td class="start">نسبة الحضور</td>${stages.map((_, k) => `<td class="num">${attPct(k)}</td>`).join('')}</tr></table>`
    : ''
  const sideBySide = (a: string, b: string) =>
    a && b ? `<div style="display:flex;gap:6px;margin-top:4px"><div style="flex:1">${a}</div><div style="flex:1">${b}</div></div>` : a || b ? `<div style="margin-top:4px">${a || b}</div>` : ''

  const insight = o.insight ? insightLines(d) : null
  const insightHtml = insight
    ? `<table style="margin-top:4px"><tr><th style="background:var(--jg-teal)">✦ قراءة جهبذ لأداء ${esc(word)} ✦</th></tr><tr><td class="start">${esc(insight[0])}</td></tr><tr><td class="start">${esc(insight[1])}</td></tr></table>`
    : ''
  const notes = `<table><tr><th>📝 ملاحظات على أداء ${esc(word)}</th></tr>${stages
    .map((s, k) => `<tr><td class="start">${esc(s)}: ${esc(d.notes[k] ?? '')}</td></tr>`)
    .join('')}</table>`
  const tips = o.guardianTips
    ? `<table><tr><th>👪 توجيهات إلى أولياء الأمور</th></tr>${d.guardianTips.map((t) => `<tr><td class="start">• ${esc(t)}</td></tr>`).join('')}</table>`
    : ''

  const signatures = `<div style="display:flex;gap:6px;margin-top:4px">
    <table style="flex:2"><tr><th>التوقيعات</th>${stages.map((s) => `<th style="font-size:7.5px">${esc(s)}</th>`).join('')}<th style="font-size:7.5px">النتيجة النهائية</th></tr>
      ${['رائد الفصل', 'مدير المدرسة', 'ولي الأمر'].map((r) => `<tr><td class="start" style="height:14px">${r}</td>${stages.map(() => '<td></td>').join('')}<td></td></tr>`).join('')}</table>
    <div style="flex:1;border:1px solid var(--jg-line);border-radius:4px;background:var(--jg-gold-soft);text-align:center;padding:3px">
      <div style="font-weight:800;color:var(--jg-navy)">اعتماد النتيجة</div><div>مدير/ة المدرسة</div><div style="font-weight:700">${esc(d.header.principal) || '..............................'}</div>
      <div style="margin:3px auto 0;width:42px;height:42px;border:2px dashed var(--jg-gold);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--jg-gold);font-weight:800">الختم</div>
    </div></div>`

  const info = `<table style="margin-top:3px"><tr>
      <td class="start" style="background:var(--jg-blue-soft);font-weight:700;width:14%">اسم ${esc(word)}</td><td class="start" colspan="3" style="font-weight:800;font-size:10px">${esc(d.student.name)}</td>
      <td style="background:var(--jg-blue-soft);font-weight:700;width:10%">الصف</td><td style="font-weight:700">${esc(d.gradeName)}</td>
      <td rowspan="4" style="width:58px;color:var(--jg-muted);font-size:7.5px;border-style:dashed">صورة<br>${esc(word)}</td></tr>
    <tr><td class="start" style="background:var(--jg-blue-soft);font-weight:700">رقم القيد</td><td class="num">${esc(d.student.registrationNumber)}</td>
      <td style="background:var(--jg-blue-soft);font-weight:700;width:10%">الجنسية</td><td>${esc(d.student.nationality)}</td>
      <td style="background:var(--jg-blue-soft);font-weight:700">الشعبة</td><td>${esc(d.sectionName)}</td></tr>
    <tr><td class="start" style="background:var(--jg-blue-soft);font-weight:700">اسم الأم</td><td colspan="3" class="start">${esc(d.student.motherName)}</td>
      <td style="background:var(--jg-blue-soft);font-weight:700">الميلاد</td><td>${esc(d.student.birth)}</td></tr>
    <tr><td class="start" style="background:var(--jg-blue-soft);font-weight:700">الرقم في الكشف</td><td class="num">${d.student.listNumber}</td>
      <td style="background:var(--jg-blue-soft);font-weight:700">النظام</td><td colspan="3">${esc(d.systemName)}</td></tr></table>`

  const body = `<div style="border:1.5px solid var(--jg-navy);border-radius:7px;padding:0 0 4px;position:relative;overflow:hidden">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.035;font-size:300px;font-weight:900;color:var(--jg-navy);pointer-events:none">ج</div>
    ${bandHtml(d.header)}
    <div style="padding:0 6px">
      <div class="title">✦ ${esc(d.title)} — ${esc(d.yearName)} م ✦</div>
      ${info}
      <table style="margin-top:4px">${head1}${head2}${subjectRows}${totalRow}</table>
      ${tiles}
      ${badge ? `<div style="text-align:center;margin-top:3px;font-weight:800;color:var(--jg-warning);background:var(--jg-gold-soft);border-radius:4px;padding:2px">${esc(badge)}</div>` : ''}
      ${sideBySide(activities, attendance)}
      ${insightHtml}
      ${sideBySide(notes, tips)}
      ${signatures}
      <div style="margin-top:4px;border:1px solid var(--jg-danger);background:var(--jg-danger-soft);color:var(--jg-danger);border-radius:4px;padding:2px 4px;font-weight:700;font-size:8px">ملاحظة مهمة: ${esc(d.ruleText)}</div>
      ${o.quote ? `<div style="margin-top:3px;color:var(--jg-warning);font-weight:700">✿ ${genderForm(d.student.gender, 'عزيزي', 'عزيزتي')} ${esc(word)}: ${esc(d.quote)}</div>` : ''}
      <div style="margin-top:3px;text-align:center;color:var(--jg-gold);letter-spacing:3px;font-size:8px">◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆ ◆</div>
      ${footHtml('منظومة جهبذ لرصد الدرجات')}
    </div></div>`
  return body
}

export function reportCardHtml(d: JgReportCardData, o: JgReportCardOptions = JG_REPORT_CARD_ALL_ON): string {
  return page(d.title, reportCardBody(d, o), 'portrait', 10)
}

/** Several cards in one document, one per A4 page. */
export function reportCardsHtml(cards: JgReportCardData[], o: JgReportCardOptions = JG_REPORT_CARD_ALL_ON): string {
  const bodies = cards.map((d, i) => `<section style="${i < cards.length - 1 ? 'break-after:page;page-break-after:always;' : ''}">${reportCardBody(d, o)}</section>`)
  return page(cards[0]?.title ?? 'report cards', bodies.join(''), 'portrait', 10)
}

export const renderReportCardPdf = (d: JgReportCardData, o?: JgReportCardOptions) =>
  renderHtmlToPdf(reportCardHtml(d, o), { margin: { top: '0', bottom: '0' } })

export const renderReportCardsPdf = (cards: JgReportCardData[], o?: JgReportCardOptions) =>
  renderHtmlToPdf(reportCardsHtml(cards, o), { margin: { top: '0', bottom: '0' } })

// ---- analytics documents (Phase 3) -----------------------------------------------------------------

const pctText = (p: number | null | undefined, d: 0 | 1 = 0) => (p === null || p === undefined ? '—' : fmtPct(p, d))
const hbar = (share: number | null, color = 'var(--jg-royal)') =>
  `<div style="background:var(--jg-blue-soft);border-radius:3px;height:9px;width:100%"><div style="background:${color};height:9px;border-radius:3px;width:${Math.round(Math.max(0, Math.min(1, share ?? 0)) * 100)}%"></div></div>`
const kv = (rows: [string, string][]) =>
  `<table>${rows.map(([k, v]) => `<tr><td class="start" style="background:var(--jg-blue-soft);font-weight:700;width:45%">${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('')}</table>`

export interface JgAnalysisDoc {
  sectionTitle: string
  subject: string
  measureLabel: string
  measureMax: number
  compareLabel: string | null
  passRate: number
  learners: string
  analysis: {
    count: number; recorded: number; missing: number; highest: number | null; lowest: number | null; mean: number | null; meanPct: number | null
    sum: number; median: number | null; mode: number | null; stdev: number | null; range: number | null; passRate: number | null; excelRate: number | null
    bands: { label: string; from: number; to: number | null; count: number; share: number | null }[]
    boys: number | null; girls: number | null
    top: { name: string; value: number }[]; remedial: { name: string; value: number }[]
    comparison: { otherMean: number | null; diffPct: number | null; improved: number; declined: number; mostImproved: { name: string; diffPct: number } | null } | null
  }
  reading: string[]
  date: string
}

/** «تحليل نتائج المادة» (B6-13), one A4 portrait page. */
export function analysisCardHtml(d: JgAnalysisDoc, header: JgPrintHeader): string {
  const a = d.analysis
  const m = (x: number | null) => (x === null ? '—' : fmtMark(Math.round(x * 100) / 100))
  const general = kv([
    ['العدد الكلي', String(a.count)], ['المرصودة درجاتهم', String(a.recorded)], ['لم تُرصد / غائب', String(a.missing)],
    ['أعلى درجة', m(a.highest)], ['أقل درجة', m(a.lowest)], ['متوسط الدرجات', m(a.mean)], ['نسبة التحصيل', pctText(a.meanPct)],
    ['مجموع الدرجات', m(a.sum)], ['الوسيط', m(a.median)], ['المنوال (الأكثر تكراراً)', m(a.mode)], ['الانحراف المعياري', m(a.stdev)],
    ['المدى', m(a.range)], ['حد النجاح', pctText(d.passRate)], ['نسبة النجاح', pctText(a.passRate)],
  ])
  const bands = `<table><tr><th>المستوى</th><th>النطاق (درجة)</th><th>العدد</th><th>النسبة</th><th style="width:30%"></th></tr>${a.bands
    .map((b) => `<tr><td style="font-weight:700">${esc(b.label)}</td><td class="num">${fmtMark(Math.round(b.from * 10) / 10)} – ${b.to === null ? fmtMark(d.measureMax) : fmtMark(Math.round((b.to - 0.01) * 100) / 100)}</td><td class="num">${b.count}</td><td class="num">${pctText(b.share)}</td><td>${hbar(b.share)}</td></tr>`)
    .join('')}</table>`
  const cmp = a.comparison
  const comparisons = kv([
    ['متوسط الذكور', m(a.boys)], ['متوسط الإناث', m(a.girls)],
    ...(cmp && d.compareLabel
      ? ([
          ['قارن مع', d.compareLabel], ['متوسطه هناك', m(cmp.otherMean)], ['الفرق', cmp.diffPct === null ? '—' : `${cmp.diffPct > 0 ? '+' : ''}${cmp.diffPct}%`],
          ['تحسّنوا', String(cmp.improved)], ['تراجعوا', String(cmp.declined)], ['الأكثر تحسّناً', cmp.mostImproved ? `${cmp.mostImproved.name} (+${cmp.mostImproved.diffPct}%)` : '—'],
        ] as [string, string][])
      : []),
  ])
  const list = (title: string, items: { name: string; value: number }[], color: string) =>
    `<table><tr><th style="background:${color}">${esc(title)}</th><th style="background:${color}">الدرجة</th></tr>${
      items.length ? items.map((x) => `<tr><td class="start">${esc(x.name)}</td><td class="num">${fmtMark(x.value)}</td></tr>`).join('') : '<tr><td colspan="2" class="muted">—</td></tr>'
    }</table>`
  const body = `${bandHtml(header)}
    <div class="title">تحليل نتائج مادة «${esc(d.subject)}»</div>
    <div class="lines" style="font-size:9px;margin-bottom:4px">${esc(d.sectionTitle)} — التحليل: ${esc(d.measureLabel)} — درجة القياس ${fmtMark(d.measureMax)}</div>
    <div style="display:flex;gap:6px"><div style="flex:1">${general}</div><div style="flex:1.3;display:flex;flex-direction:column;gap:6px">${bands}${comparisons}</div></div>
    <table style="margin-top:6px"><tr><th style="background:var(--jg-teal)">قراءة آلية للنتائج وتوصيات</th></tr>${d.reading.map((r) => `<tr><td class="start">${esc(r)}</td></tr>`).join('')}</table>
    <div style="display:flex;gap:6px;margin-top:6px"><div style="flex:1">${list('🏆 الأوائل في هذا التحليل', a.top, 'var(--jg-gold)')}</div><div style="flex:1">${list(`دون حد النجاح (${pctText(d.passRate)}) — يحتاجون خطة علاجية: ${a.remedial.length}`, a.remedial, 'var(--jg-danger)')}</div></div>
    <div class="sign"><div>معلم/ـة المادة<br><span class="muted">التوقيع: ..................</span></div><div>مدير/ة المدرسة<br><span class="muted">التوقيع: ..................</span></div><div>تاريخ التحليل<br><span class="num">${esc(d.date)}</span></div></div>
    ${footHtml('منظومة جهبذ لرصد الدرجات')}`
  return page(`تحليل ${d.subject}`, body, 'portrait', 9.5)
}

export interface JgItemAnalysisDoc {
  name: string
  subject: string | null
  date: string | null
  sectionTitle: string
  questions: { max: number; level?: string | null }[]
  students: { name: string; scores: (number | null)[]; total: number; pct: number; rank: number }[]
  analysis: {
    items: { mean: number | null; p: number | null; upperMean: number | null; lowerMean: number | null; d: number | null; variance: number | null; verdict: string | null }[]
    count: number; maxTotal: number; meanTotal: number | null; sd: number | null; alpha: number | null; sem: number | null
    reliability: string | null; toReview: number; bloom: { level: string; questions: number; mastery: number | null }[]
  }
  verdictLabels: Record<string, string>
  reliabilityLabels: Record<string, string>
}

/** «تحليل الاختبار» (B6-12), A4 landscape. */
export function itemAnalysisHtml(d: JgItemAnalysisDoc, header: JgPrintHeader): string {
  const a = d.analysis
  const n = d.questions.length
  const r2 = (x: number | null) => (x === null ? '' : (Math.round(x * 100) / 100).toFixed(2))
  const qHead = d.questions.map((_, i) => `<th>س${i + 1}</th>`).join('')
  const rows = d.students
    .map((s, i) => `<tr><td class="num">${i + 1}</td><td class="start">${esc(s.name)}</td>${s.scores.map((v) => `<td class="num">${v === null ? '' : fmtMark(v)}</td>`).join('')}<td class="num" style="font-weight:700">${fmtMark(s.total)}</td><td class="num">${fmtPct(s.pct)}</td><td class="num">${s.rank}</td></tr>`)
    .join('')
  const line = (label: string, cells: string[]) => `<tr><td colspan="2" class="start" style="background:var(--jg-teal);color:#fff;font-weight:700">${esc(label)}</td>${cells.map((c) => `<td class="num">${c}</td>`).join('')}<td colspan="3"></td></tr>`
  const tone = (v: string | null) => (v === 'reversed' || v === 'weak' ? 't-destructive' : v === 'too_easy' || v === 'too_hard' ? 't-warning' : 't-success')
  const summary = kv([
    ['عدد التلاميذ', String(a.count)], ['عدد الأسئلة', String(n)], ['متوسط الدرجة الكلية', a.meanTotal === null ? '—' : String(Math.round(a.meanTotal * 10) / 10)],
    ['الانحراف المعياري', r2(a.sd)], ['معامل الثبات (ألفا كرونباخ)', r2(a.alpha)], ['الخطأ المعياري للقياس', r2(a.sem)],
    ['الحكم على ثبات الاختبار', a.reliability ? d.reliabilityLabels[a.reliability] : '—'], ['أسئلة تحتاج مراجعة أو حذف', String(a.toReview)],
  ])
  const bloom = `<table><tr><th>المهارة</th><th>عدد الأسئلة</th><th>نسبة الإتقان</th><th style="width:35%"></th></tr>${a.bloom
    .map((b) => `<tr><td>${esc(b.level)}</td><td class="num">${b.questions}</td><td class="num">${pctText(b.mastery)}</td><td>${b.mastery === null ? '' : hbar(b.mastery, 'var(--jg-teal)')}</td></tr>`)
    .join('')}</table>`
  const dBars = `<div style="display:flex;align-items:center;gap:3px;height:70px;border:1px solid var(--jg-line);border-radius:4px;padding:4px">${a.items
    .map((it, i) => {
      const v = it.d ?? 0
      const h = Math.round(Math.min(1, Math.abs(v)) * 28)
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;height:62px"><div style="height:28px;display:flex;align-items:flex-end"><div style="width:10px;height:${v > 0 ? h : 0}px;background:var(--jg-teal)"></div></div><div style="height:28px;display:flex;align-items:flex-start"><div style="width:10px;height:${v < 0 ? h : 0}px;background:var(--jg-danger)"></div></div><div style="font-size:7px">س${i + 1}</div></div>`
    })
    .join('')}</div>`
  const body = `${bandHtml(header)}
    <div class="title">تحليل الاختبار: جودة الأسئلة وثبات الاختبار وإتقان المهارات</div>
    <div class="lines" style="font-size:9px;margin-bottom:4px">${esc(d.name)}${d.subject ? ` — ${esc(d.subject)}` : ''}${d.date ? ` — ${esc(d.date)}` : ''} — ${esc(d.sectionTitle)}</div>
    <table style="table-layout:fixed"><colgroup><col style="width:3%"><col style="width:13%">${d.questions.map(() => `<col style="width:${(70 / Math.max(1, n)).toFixed(2)}%">`).join('')}<col style="width:5%"><col style="width:4%"><col style="width:5%"></colgroup>
      <tr><th>رقم</th><th>الاسم</th>${qHead}<th>المجموع</th><th>النسبة</th><th>الترتيب</th></tr>
      <tr style="background:var(--jg-gold-soft);font-weight:700"><td colspan="2">الدرجة العظمى للسؤال</td>${d.questions.map((q) => `<td class="num">${fmtMark(q.max)}</td>`).join('')}<td class="num">${fmtMark(a.maxTotal)}</td><td colspan="2"></td></tr>
      <tr><td colspan="2">المهارة / المستوى المعرفي</td>${d.questions.map((q) => `<td style="font-size:7px">${esc(q.level ?? '')}</td>`).join('')}<td colspan="3"></td></tr>
      ${rows}
      ${line('متوسط الدرجة', a.items.map((it) => (it.mean === null ? '' : String(Math.round(it.mean * 10) / 10))))}
      ${line('معامل السهولة (p)', a.items.map((it) => r2(it.p)))}
      ${line('متوسط الفئة العليا 27%', a.items.map((it) => (it.upperMean === null ? '' : String(Math.round(it.upperMean * 10) / 10))))}
      ${line('متوسط الفئة الدنيا 27%', a.items.map((it) => (it.lowerMean === null ? '' : String(Math.round(it.lowerMean * 10) / 10))))}
      ${line('معامل التمييز (D)', a.items.map((it) => r2(it.d)))}
      <tr><td colspan="2" class="start" style="background:var(--jg-teal);color:#fff;font-weight:700">الحكم على السؤال</td>${a.items.map((it) => `<td class="${tone(it.verdict)}" style="font-size:7px">${esc(it.verdict ? d.verdictLabels[it.verdict] : '')}</td>`).join('')}<td colspan="3"></td></tr>
    </table>
    <div style="display:flex;gap:6px;margin-top:6px"><div style="flex:1">${summary}</div><div style="flex:1">${bloom}</div><div style="flex:1"><div style="font-weight:700;margin-bottom:2px">معامل التمييز لكل سؤال</div>${dBars}</div></div>
    ${footHtml('منظومة جهبذ لرصد الدرجات')}`
  return page(d.name, body, 'landscape', 8.5)
}

export interface JgProfileDoc {
  title: string
  sectionTitle: string
  studentName: string
  stageNames: string[]
  subjects: { name: string; stages: (number | null)[]; round2: number | null; final: number | null; max: number; pct: number | null; estimate: string | null; result: string | null; classAvgPct: number | null }[]
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  rank: number | null
  classSize: number
  supportSubjects: string[]
  decision: string
  feedback: string
}

/** «بطاقة التلميذ» (B6-7): table, student vs class chart, feedback, signatures. */
export function studentProfileHtml(d: JgProfileDoc, header: JgPrintHeader): string {
  const head = `<tr><th>المادة</th>${d.stageNames.map((s) => `<th>${esc(s)}</th>`).join('')}<th>الدور الثاني</th><th>الدرجة النهائية</th><th>العظمى</th><th>النسبة</th><th>التقدير</th><th>النتيجة</th><th>متوسط الفصل</th></tr>`
  const rows = d.subjects
    .map((s) => `<tr><td class="start" style="font-weight:700">${esc(s.name)}</td>${s.stages.map((v) => `<td class="num">${fmtMark(v)}</td>`).join('')}<td class="num">${s.round2 === null ? '' : fmtMark(s.round2)}</td><td class="num" style="font-weight:700;background:var(--jg-gold-soft)">${fmtMark(s.final)}</td><td class="num">${fmtMark(s.max)}</td><td class="num">${pctText(s.pct)}</td><td>${esc(s.estimate ?? '')}</td><td>${esc(s.result ?? '')}</td><td class="num">${pctText(s.classAvgPct)}</td></tr>`)
    .join('')
  const chart = `<table><tr><th colspan="2">بصمة التلميذ: نسبته في كل مادة مقارنة بمتوسط الفصل</th></tr>${d.subjects
    .map((s) => `<tr><td class="start" style="width:28%">${esc(s.name)}</td><td>${hbar(s.pct)}<div style="height:2px"></div>${hbar(s.classAvgPct, 'var(--jg-gold)')}</td></tr>`)
    .join('')}<tr><td colspan="2" class="muted"><span style="color:var(--jg-royal)">■</span> نسبة التلميذ &nbsp; <span style="color:var(--jg-gold)">■</span> متوسط الفصل</td></tr></table>`
  const body = `${bandHtml(header)}
    <div class="title">${esc(d.title)}</div>
    <table style="margin-bottom:4px"><tr><td class="start" style="background:var(--jg-blue-soft);font-weight:700;width:18%">الاسم</td><td class="start" style="font-weight:800">${esc(d.studentName)}</td><td style="background:var(--jg-blue-soft);font-weight:700;width:14%">الصف / الفصل</td><td>${esc(d.sectionTitle)}</td></tr></table>
    <table>${head}${rows}<tr style="background:var(--jg-navy);color:#fff;font-weight:800"><td class="start" style="color:var(--jg-gold)">المجموع العام</td><td colspan="${d.stageNames.length + 1}"></td><td class="num">${fmtMark(d.total)}</td><td class="num">${fmtMark(d.max)}</td><td class="num">${pctText(d.pct, 1)}</td><td>${esc(d.estimate ?? '')}</td><td colspan="2"></td></tr></table>
    ${kv([['الترتيب في الفصل', d.rank === null ? '—' : `${d.rank} من ${d.classSize}`], ['القرار', d.decision], ['مواد الدور الثاني / تحتاج دعماً', d.supportSubjects.join('، ') || 'لا توجد']])}
    <table style="margin-top:4px"><tr><th style="background:var(--jg-teal)">✦ تغذية راجعة آلية</th></tr><tr><td class="start" style="line-height:1.7">${esc(d.feedback)}</td></tr></table>
    <div style="margin-top:4px">${chart}</div>
    <table style="margin-top:4px"><tr><td class="start" style="height:34px;vertical-align:top;font-weight:700">ملاحظات المعلم/ـة :</td></tr></table>
    ${signaturesHtml(header)}${footHtml('منظومة جهبذ لرصد الدرجات')}`
  return page(d.title, body, 'portrait', 9.5)
}

const noMargin = { margin: { top: '0', bottom: '0' } }
export const renderAnalysisCardPdf = (d: JgAnalysisDoc, h: JgPrintHeader) => renderHtmlToPdf(analysisCardHtml(d, h), noMargin)
export const renderItemAnalysisPdf = (d: JgItemAnalysisDoc, h: JgPrintHeader) => renderHtmlToPdf(itemAnalysisHtml(d, h), { landscape: true, ...noMargin })
export const renderStudentProfilePdf = (d: JgProfileDoc, h: JgPrintHeader) => renderHtmlToPdf(studentProfileHtml(d, h), noMargin)
