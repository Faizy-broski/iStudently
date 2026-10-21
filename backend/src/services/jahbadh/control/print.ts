import { supabase } from '../../../config/supabase'
import { JC_SPECIAL_CASES_AR, seatingMap } from '../../../lib/jahbadh'
import { escapeHtml as esc, renderHtmlToPdf } from '../../../utils/html-pdf.util'
import { getSettings, JgError } from '../grades.service'
import { bandHtml, footHtml, page, printHeader, type JgPrintHeader } from '../print.service'
import { listCommittees, loadSecrets, loadStudents, logJc, need, type JcCommittee, type JcContext, type JcStudentRow } from './core'
import { listDays, listInvigilation, listInvigilators, type JcDay } from './planning'
import { buildQrPayload, qrSvg } from './qr'
import { results } from './scores'

/**
 * Printable documents of exam control (brief C6.5): A4 RTL, school header, Jahbadh footer. Committee
 * documents accept one committee or all (one PDF, page break per committee). Confidential documents
 * (secret numbers) need secret-view rights.
 */
export const JC_DOCS = [
  'general_list', 'secret_lists', 'committee_mirror', 'envelope_mirror', 'delivery_sheet', 'student_cards', 'booklet_covers',
  'seating_map', 'timetable', 'invigilation', 'attendance_sheet', 'minutes_open', 'minutes_absence', 'minutes_seal', 'minutes_incident',
  'results', 'honor_board', 'certificates',
] as const
export type JcDoc = (typeof JC_DOCS)[number]

const CONFIDENTIAL: JcDoc[] = ['general_list', 'secret_lists', 'booklet_covers']
const NEEDS_DAY: JcDoc[] = ['attendance_sheet', 'minutes_open', 'minutes_absence', 'minutes_seal', 'minutes_incident']
const LANDSCAPE: JcDoc[] = ['general_list', 'timetable', 'invigilation', 'results']

const breakAfter = (i: number, n: number) => (i < n - 1 ? 'break-after:page;page-break-after:always;' : '')
const table = (head: string[], rows: (string | number | null)[][], widths?: string[]) =>
  `<table style="table-layout:fixed"><colgroup>${(widths ?? head.map(() => 'auto')).map((w) => `<col style="width:${w}">`).join('')}</colgroup><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td class="${i === 1 || typeof c === 'string' ? 'start' : 'num'}">${c === null || c === undefined ? '' : esc(String(c))}</td>`).join('')}</tr>`)
    .join('')}</table>`
const signLine = (labels: string[]) => `<div class="sign">${labels.map((l) => `<div>${esc(l)}<br><span class="muted">التوقيع: ..................</span></div>`).join('')}</div>`

function title(text: string, sub?: string) {
  return `<div class="title">${esc(text)}</div>${sub ? `<div class="lines" style="font-size:9.5px;margin-bottom:4px">${esc(sub)}</div>` : ''}`
}

interface Data {
  ctx: JcContext
  header: JgPrintHeader
  students: JcStudentRow[]
  committees: JcCommittee[]
  secrets: Map<string, { secret: number; check: number }>
  days: JcDay[]
}

async function load(ctx: JcContext): Promise<Data> {
  const settings = await getSettings(ctx.rootId, ctx.session.campus_id)
  const [header, students, committees, secrets, days] = await Promise.all([
    printHeader(ctx.session.campus_id ?? ctx.session.school_id, settings),
    loadStudents(ctx),
    listCommittees(ctx),
    ctx.can.secret ? loadSecrets(ctx) : Promise.resolve(new Map()),
    listDays(ctx),
  ])
  return { ctx, header, students: students.filter((s) => s.status === 'participating'), committees, secrets, days }
}

const inCommittee = (d: Data, c: JcCommittee) => d.students.filter((s) => s.committee_id === c.id).sort((a, b) => (a.seat_index ?? 0) - (b.seat_index ?? 0))
/** Dates are isolated (LRI…PDI) so they keep their digit order inside Arabic lines. */
const ltr = (x: string) => `\u2066${x}\u2069`
const sessionLine = (d: Data) => `${d.ctx.session.name} — ${ltr(d.ctx.session.issue_date)}`

function perCommittee(d: Data, committeeId: string | null, render: (c: JcCommittee, list: JcStudentRow[]) => string) {
  const list = d.committees.filter((c) => (!committeeId || c.id === committeeId) && inCommittee(d, c).length)
  if (!list.length) throw new JgError(404, 'No committee with students')
  return list.map((c, i) => `<section style="${breakAfter(i, list.length)}">${bandHtml(d.header, 'كنترول جهبذ')}${render(c, inCommittee(d, c))}${footHtml(`${c.name}`)}</section>`).join('')
}

function perDayCommittee(d: Data, day: JcDay, committeeId: string | null, render: (c: JcCommittee, list: JcStudentRow[]) => string) {
  const list = d.committees.filter((c) => (!committeeId || c.id === committeeId) && inCommittee(d, c).some((s) => day.grade_codes.includes(s.grade_code)))
  if (!list.length) throw new JgError(404, 'No committee sits this exam')
  return list
    .map((c, i) => `<section style="${breakAfter(i, list.length)}">${bandHtml(d.header, 'كنترول جهبذ')}${render(c, inCommittee(d, c).filter((s) => day.grade_codes.includes(s.grade_code)))}${footHtml(c.name)}</section>`)
    .join('')
}

async function invigilatorNames(ctx: JcContext) {
  const invs = await listInvigilators(ctx)
  return new Map(invs.map((x) => [x.staff_id, x.name]))
}

export async function renderDoc(ctx: JcContext, doc: JcDoc, opts: { committee_id?: string | null; day_id?: string | null }): Promise<{ pdf: Buffer; name: string }> {
  if (!JC_DOCS.includes(doc)) throw new JgError(400, 'Unknown document')
  if (CONFIDENTIAL.includes(doc)) need(ctx.can.secret, 'This document contains secret numbers (control chief only)')
  else need(ctx.can.manage || ctx.can.examday)
  const d = await load(ctx)
  const day = opts.day_id ? d.days.find((x) => x.id === opts.day_id) : null
  if (NEEDS_DAY.includes(doc) && !day) throw new JgError(400, 'Choose the exam day')
  const cid = opts.committee_id || null
  const s = ctx.session.settings
  let body = ''

  if (doc === 'general_list') {
    const rows = d.students
      .filter((x) => x.committee_id)
      .sort((a, b) => (a.global_order ?? 0) - (b.global_order ?? 0))
      .map((x) => [d.committees.find((c) => c.id === x.committee_id)?.name ?? '', x.name, x.seat_index, x.grade_level_name, x.section_name ?? '', x.seat_number, d.secrets.get(x.id)?.secret ?? ''])
    body = `${bandHtml(d.header, 'كنترول جهبذ')}${title('الكشف العام للتوزيع — سري للغاية', sessionLine(d))}${table(['اللجنة', 'الاسم', 'المقعد', 'الصف', 'الشعبة', 'رقم الجلوس', 'الرقم السري'], rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]]), ['10%', '34%', '7%', '14%', '10%', '12%', '13%'])}${footHtml('سري — الكنترول فقط')}`
  } else if (doc === 'secret_lists') {
    body = perCommittee(d, cid, (c, list) => `${title(`قائمة الأرقام السرية وأرقام الجلوس — ${c.name} — سري`, sessionLine(d))}${table(['م', 'الاسم', 'الصف', 'رقم الجلوس', 'الرقم السري'], list.map((x) => [x.seat_index, x.name, x.grade_level_name, x.seat_number, d.secrets.get(x.id)?.secret ?? '']), ['7%', '45%', '18%', '15%', '15%'])}`)
  } else if (doc === 'committee_mirror' || doc === 'envelope_mirror' || doc === 'delivery_sheet') {
    const heading = { committee_mirror: 'مرآة اللجنة', envelope_mirror: 'مرآة المغلف', delivery_sheet: 'كشف تسليم كراسة الإجابة' }[doc]
    body = perCommittee(d, cid, (c, list) => {
      const head = doc === 'delivery_sheet' ? ['م', 'الاسم', 'رقم الجلوس', 'التوقيع'] : ['م', 'الاسم', 'الصف', 'رقم الجلوس']
      const rows = list.map((x) => (doc === 'delivery_sheet' ? [x.seat_index, x.name, x.seat_number, ''] : [x.seat_index, x.name, x.grade_level_name, x.seat_number]))
      const extra =
        doc === 'envelope_mirror'
          ? `<table style="margin-top:6px"><tr><td class="start">عدد الكراسات: ................</td><td class="start">وقت الاستلام: ................</td></tr><tr><td class="start">توقيع الملاحظ: ................</td><td class="start">توقيع المستلم: ................</td></tr></table>`
          : ''
      return `${title(`${heading} — ${c.name}${c.room_label ? ` — ${c.room_label}` : ''}`, sessionLine(d))}${table(head, rows, ['7%', '53%', '20%', '20%'])}${extra}`
    })
  } else if (doc === 'student_cards') {
    const list = d.students.filter((x) => x.committee_id && (!cid || x.committee_id === cid)).sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))
    const cards = await Promise.all(
      list.map(async (x) => {
        const c = d.committees.find((k) => k.id === x.committee_id)
        const qr = s.qr_enabled && s.qr_on_cards ? await qrSvg(buildQrPayload('card', ctx.session.session_code, { seat: x.seat_number ?? 0 })) : ''
        return `<div style="border:1.5px solid var(--jg-navy);border-radius:6px;padding:6px;display:flex;gap:6px;align-items:center;height:62mm;break-inside:avoid">
          <div style="flex:1"><div style="font-weight:800;color:var(--jg-navy);font-size:11px">${esc(d.header.schoolName)}</div><div class="muted" style="font-size:8px">${esc(ctx.session.name)}</div>
          <div style="font-weight:800;font-size:12px;margin-top:4px">${esc(x.name)}</div><div>${esc(x.grade_level_name)}</div><div>${esc(c?.name ?? '')}${c?.room_label ? ` — ${esc(c.room_label)}` : ''}</div>
          <div style="font-size:20px;font-weight:900;color:var(--jg-royal)" class="num">${x.seat_number}</div>${x.special_case ? `<div class="chip t-warning">${esc(JC_SPECIAL_CASES_AR[x.special_case as keyof typeof JC_SPECIAL_CASES_AR] ?? '')}</div>` : ''}</div>
          ${qr ? `<div style="width:${Math.round(Math.max(15, s.qr_size_mm - 5) * 1.3)}mm">${qr}</div>` : ''}</div>`
      }),
    )
    body = `${bandHtml(d.header, 'كنترول جهبذ')}${title('بطاقات الطلبة', sessionLine(d))}<div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm">${cards.join('')}</div>${footHtml()}`
  } else if (doc === 'booklet_covers') {
    const list = d.students.filter((x) => x.committee_id && (!cid || x.committee_id === cid)).sort((a, b) => (a.global_order ?? 0) - (b.global_order ?? 0))
    if (!list.length) throw new JgError(404, 'No students')
    const subjectLine = day ? `${day.subject_name} — ${ltr(day.exam_date)}` : '................'
    const pages = await Promise.all(
      list.map(async (x, i) => {
        const secret = d.secrets.get(x.id)?.secret ?? 0
        const c = d.committees.find((k) => k.id === x.committee_id)
        const topQr = s.qr_enabled && s.qr_on_covers ? await qrSvg(buildQrPayload('booklet', ctx.session.session_code, { secret })) : ''
        const stubQr = s.qr_enabled && s.qr_on_stubs ? await qrSvg(buildQrPayload('stub', ctx.session.session_code, { secret, seat: x.seat_number ?? 0 })) : ''
        const q = Array.from({ length: s.q_count }, (_, k) => `<th>س${k + 1}</th>`).join('')
        return `<section style="${breakAfter(i, list.length)}">${bandHtml(d.header, 'كنترول جهبذ')}
          <div style="border:2px solid var(--jg-navy);border-radius:8px;padding:8px;margin-top:6px">
            <div class="title">غلاف كراسة الإجابة</div>
            <table><tr><td class="start">الامتحان: ${esc(ctx.session.name)}</td><td class="start">المادة: ${esc(subjectLine)}</td></tr>
            <tr><td class="start">الصف: ${esc(x.grade_level_name)}</td><td class="start">اللجنة: ${esc(c?.name ?? '')}</td></tr></table>
            <div style="display:flex;align-items:center;justify-content:center;gap:12mm;margin:8mm 0">
              ${topQr ? `<div style="width:${Math.round(s.qr_size_mm * 1.3)}mm">${topQr}</div>` : ''}
              <div style="text-align:center"><div class="muted">الرقم السري</div><div class="num" style="font-size:34px;font-weight:900;letter-spacing:3px">${secret}</div></div>
            </div>
            <table><tr>${q}<th>المجموع</th></tr><tr>${Array.from({ length: s.q_count + 1 }, () => '<td style="height:12mm"></td>').join('')}</tr></table>
            <div class="sign"><div>اسم المصحح: ........................</div><div>التوقيع: ..................</div></div>
          </div>
          <div style="margin:8mm 0 4mm;border-top:2px dashed var(--jg-muted);position:relative"><span style="position:absolute;top:-9px;inset-inline-start:0;background:#fff;padding:0 4px">✂</span></div>
          <div style="border:1.5px solid var(--jg-royal);border-radius:8px;padding:8px;display:flex;align-items:center;gap:8mm">
            <div style="flex:1"><div style="font-weight:800">قسيمة الكنترول</div>
              <div>الاسم: <b>${esc(x.name)}</b></div><div>رقم الجلوس: <b class="num">${x.seat_number}</b> — الرقم السري: <b class="num">${secret}</b></div>
              <div class="muted" style="font-size:8px;margin-top:3px">تُفصل هذه القسيمة وتحتفظ بها لجنة الكنترول؛ لا تبقى على الكراسة.</div></div>
            ${stubQr ? `<div style="width:${Math.round(Math.max(20, s.qr_size_mm) * 1.3)}mm">${stubQr}</div>` : ''}
          </div>${footHtml()}</section>`
      }),
    )
    body = pages.join('')
  } else if (doc === 'seating_map') {
    body = perCommittee(d, cid, (c, list) => {
      const map = seatingMap(list.length, c.seat_columns).slice(0, 8)
      const byIdx = new Map(list.map((x) => [x.seat_index, x]))
      const grid = map
        .map((row) => `<tr>${row.map((seat) => {
          const st = seat.seatIndex ? byIdx.get(seat.seatIndex) : null
          const tone = !st ? '' : seat.model === 'A' ? 'background:var(--jg-blue-soft)' : 'background:var(--jg-gold-soft)'
          return `<td style="height:16mm;${tone}">${st ? `<div class="num" style="font-weight:800">${st.seat_number}</div><div style="font-size:7.5px">${esc(st.grade_level_name)}</div>${s.paper_models ? `<div style="font-weight:700">${seat.model}</div>` : ''}` : ''}</td>`
        }).join('')}</tr>`)
        .join('')
      return `${title(`خريطة الجلوس — ${c.name}${c.room_label ? ` — ${c.room_label}` : ''}`, sessionLine(d))}<div class="lines" style="margin:4px 0">↑ السبورة / مقدمة القاعة</div><table>${grid}</table>
        ${s.paper_models ? '<div class="muted" style="margin-top:4px"><span style="background:var(--jg-blue-soft);padding:0 6px">نموذج (أ)</span> <span style="background:var(--jg-gold-soft);padding:0 6px">نموذج (ب)</span> — لا يتجاور نموذجان متماثلان أماماً أو خلفاً أو جانباً.</div>' : ''}`
    })
  } else if (doc === 'timetable') {
    const rows = d.days.map((x) => [x.exam_date, x.subject_name, x.grade_codes.join('، '), x.start_time?.slice(0, 5) ?? '', x.end_time?.slice(0, 5) ?? '', x.duration_minutes ?? ''])
    body = `${bandHtml(d.header, 'كنترول جهبذ')}${title('جدول الامتحانات', sessionLine(d))}${table(['التاريخ', 'المادة', 'الصفوف', 'من', 'إلى', 'المدة (دقيقة)'], rows)}${footHtml()}`
  } else if (doc === 'invigilation') {
    const [duties, names] = await Promise.all([listInvigilation(ctx), invigilatorNames(ctx)])
    const rows = d.days.flatMap((x) =>
      d.committees.filter((c) => duties.some((u: any) => u.exam_day_id === x.id && u.committee_id === c.id)).map((c) => [
        x.exam_date, x.subject_name, c.name,
        duties.filter((u: any) => u.exam_day_id === x.id && u.committee_id === c.id).sort((a: any, b: any) => a.slot - b.slot).map((u: any) => names.get(u.staff_id) ?? '').join('، '),
        duties.filter((u: any) => u.exam_day_id === x.id && u.is_reserve).map((u: any) => names.get(u.staff_id) ?? '').join('، '),
      ]),
    )
    body = `${bandHtml(d.header, 'كنترول جهبذ')}${title('جدول المراقبة', sessionLine(d))}${table(['التاريخ', 'المادة', 'اللجنة', 'الملاحظون', 'الاحتياط'], rows, ['12%', '18%', '12%', '35%', '23%'])}${footHtml()}`
  } else if (doc === 'attendance_sheet') {
    body = perDayCommittee(d, day!, cid, (c, list) => `${title(`كشف الحضور اليومي — ${c.name}`, `${day!.subject_name} — ${ltr(day!.exam_date)}`)}${table(['م', 'الاسم', 'رقم الجلوس', 'الحضور', 'التوقيع'], list.map((x) => [x.seat_index, x.name, x.seat_number, '', '']), ['7%', '43%', '15%', '15%', '20%'])}${signLine(['الملاحظ الأول', 'الملاحظ الثاني'])}`)
  } else if (doc.startsWith('minutes_')) {
    const [duties, names, { data: att }, { data: vio }] = await Promise.all([
      listInvigilation(ctx), invigilatorNames(ctx),
      supabase.from('jc_attendance').select('session_student_id, state').eq('exam_day_id', day!.id),
      supabase.from('jc_violations').select('*').eq('exam_day_id', day!.id),
    ])
    const weekday = new Date(`${day!.exam_date}T12:00:00`).toLocaleDateString('ar-LY', { weekday: 'long' })
    body = perDayCommittee(d, day!, cid, (c, list) => {
      const inv = duties.filter((u: any) => u.exam_day_id === day!.id && u.committee_id === c.id).map((u: any) => names.get(u.staff_id) ?? '').join('، ')
      const info = `<table><tr><td class="start">اليوم والتاريخ: ${esc(weekday)} ${esc(day!.exam_date)}</td><td class="start">الزمن: ${esc(day!.start_time?.slice(0, 5) ?? '')} – ${esc(day!.end_time?.slice(0, 5) ?? '')}</td></tr>
        <tr><td class="start">المادة: ${esc(day!.subject_name)}</td><td class="start">اللجنة: ${esc(c.name)}${c.room_label ? ` — ${esc(c.room_label)}` : ''}</td></tr><tr><td class="start" colspan="2">الملاحظون: ${esc(inv)}</td></tr></table>`
      const absent = list.filter((x) => (att ?? []).some((a: any) => a.session_student_id === x.id && a.state === 'absent'))
      const violations = (vio ?? []).filter((v: any) => list.some((x) => x.id === v.session_student_id))
      const text = {
        minutes_open: `<p style="margin:6px 0;line-height:1.9">إنه في اليوم والتاريخ المذكورين أعلاه، تم فتح مظروف أسئلة مادة «${esc(day!.subject_name)}» أمام الملاحظين والطلبة الحاضرين، وتبيّن أنه سليم ومختوم ولم يُعبث به، وعدد الأوراق: ............ وعليه حُرر هذا المحضر.</p>`,
        minutes_absence: `<p style="margin:6px 0">أسماء الطلبة الغائبين عن امتحان مادة «${esc(day!.subject_name)}»:</p>${table(['م', 'الاسم', 'رقم الجلوس'], absent.map((x, k) => [k + 1, x.name, x.seat_number]), ['10%', '60%', '30%'])}<p>عدد الغائبين: ${absent.length}</p>`,
        minutes_seal: `<p style="margin:6px 0;line-height:1.9">تم جمع كراسات الإجابة وعددها (............) كراسة، ومطابقتها مع عدد الحاضرين (${list.length - absent.length})، ووضعها في المغلف وإغلاقه وختمه وتسليمه إلى لجنة الكنترول في تمام الساعة ............</p>`,
        minutes_incident: `<p style="margin:6px 0">الوقائع والمخالفات المسجلة:</p>${table(['م', 'الاسم', 'رقم الجلوس', 'المخالفة', 'الإجراء'], violations.map((v: any, k: number) => {
          const st = list.find((x) => x.id === v.session_student_id)
          return [k + 1, st?.name ?? '', st?.seat_number ?? '', v.type, v.action_taken ?? '']
        }), ['6%', '34%', '14%', '24%', '22%'])}`,
      }[doc as 'minutes_open' | 'minutes_absence' | 'minutes_seal' | 'minutes_incident']
      const heading = { minutes_open: 'محضر فتح مظروف الأسئلة', minutes_absence: 'محضر غياب الطلبة', minutes_seal: 'محضر غلق مغلف الإجابة وتسليمه', minutes_incident: 'محضر واقعة / مخالفة' }[doc as 'minutes_open']
      return `${title(heading, sessionLine(d))}${info}${text}${signLine(['الملاحظ الأول', 'الملاحظ الثاني', s.chief_name ? `رئيس الكنترول: ${s.chief_name}` : 'رئيس الكنترول'])}`
    })
  } else if (doc === 'results' || doc === 'honor_board' || doc === 'certificates') {
    const r = await results(ctx)
    if (doc === 'results') {
      body = r.grades.map((g, i) => {
        const list = r.students.filter((x) => x.grade_level_id === g.grade_level_id).sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0))
        const rows = list.map((x) => [x.seat_number, x.name, ...g.subjects.map((sub) => {
          const v = x.scores[sub.key]
          return !v ? '' : v.absent ? 'غ' : String(Number(v.score))
        }), x.pct === null ? '' : `${Math.round(x.pct * 1000) / 10}%`])
        return `<section style="${breakAfter(i, r.grades.length)}">${bandHtml(d.header, 'كنترول جهبذ')}${title(`نتائج الامتحان — ${g.name}`, sessionLine(d))}${table(['رقم الجلوس', 'الاسم', ...g.subjects.map((sub) => `${sub.name} (${sub.max})`), 'النسبة'], rows)}${signLine(['رئيس الكنترول', 'مدير/ة المدرسة'])}${footHtml()}</section>`
      }).join('')
    } else if (doc === 'honor_board') {
      const medal = (p: number) => (p === 1 ? '🥇 الأول' : p === 2 ? '🥈 الثاني' : p === 3 ? '🥉 الثالث' : `${p}`)
      body = `${bandHtml(d.header, 'كنترول جهبذ')}${title('لوحة الشرف', sessionLine(d))}${table(['الصف', 'المركز', 'الاسم', 'النسبة'], r.honor_board.map((b) => [b.grade_level_name, medal(b.place), b.name, b.pct === null ? '' : `${Math.round(b.pct * 1000) / 10}%`]), ['22%', '18%', '40%', '20%'])}${footHtml()}`
    } else {
      if (!r.honor_board.length) throw new JgError(404, 'No results yet')
      body = r.honor_board.map((b, i) => `<section style="${breakAfter(i, r.honor_board.length)}">${bandHtml(d.header, 'كنترول جهبذ')}
        <div style="border:6px double var(--jg-gold);border-radius:10px;padding:18mm 12mm;margin-top:8mm;text-align:center;min-height:170mm">
          <div style="font-size:30px;font-weight:900;color:var(--jg-navy)">شهادة تفوّق</div>
          <div style="margin-top:10mm;font-size:14px">تتشرف إدارة ${esc(d.header.schoolName)} بمنح</div>
          <div style="margin-top:6mm;font-size:24px;font-weight:900;color:var(--jg-royal)">${esc(b.name)}</div>
          <div style="margin-top:6mm;font-size:14px">هذه الشهادة لحصوله على المركز <b>${b.place === 1 ? 'الأول' : b.place === 2 ? 'الثاني' : b.place === 3 ? 'الثالث' : b.place}</b> في ${esc(b.grade_level_name)}</div>
          <div style="margin-top:3mm">في ${esc(ctx.session.name)} بنسبة <b class="num">${b.pct === null ? '' : `${Math.round(b.pct * 1000) / 10}%`}</b></div>
          <div style="margin-top:4mm;color:var(--jg-gold);font-size:18px">✦ ✦ ✦</div>
          ${signLine([s.chief_name ? `رئيس الكنترول: ${s.chief_name}` : 'رئيس الكنترول', `مدير/ة المدرسة${d.header.principal ? `: ${d.header.principal}` : ''}`])}
        </div>${footHtml()}</section>`).join('')
    }
  }

  const html = page(`${ctx.session.name} — ${doc}`, body, LANDSCAPE.includes(doc) ? 'landscape' : 'portrait', 9.5)
  const pdf = await renderHtmlToPdf(html, { landscape: LANDSCAPE.includes(doc), margin: { top: '0', bottom: '0' } })
  await logJc(ctx, 'print', 'document', doc, null, { committee_id: cid, day_id: opts.day_id ?? null })
  return { pdf, name: `${doc}.pdf` }
}
