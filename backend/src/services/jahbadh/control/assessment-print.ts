import { JA_BUBBLE_GEOMETRY as G, JA_OPTIONS, gradeSheet, keyFor, luhnDigit, secretDigits, type JaVersion } from '../../../lib/jahbadh'
import { escapeHtml as esc, renderHtmlToPdf } from '../../../utils/html-pdf.util'
import { getSettings, JgError } from '../grades.service'
import { bandHtml, footHtml, page, printHeader } from '../print.service'
import { keyState, listKeys } from './assessment'
import { getGrades, listCommittees, loadStudents, logJc, need, type JcContext } from './core'
import { qrSignature, qrSvg } from './qr'

/**
 * Printouts of the assessment tools: student error slips («أخطاء الطلبة», #56) and bubble answer sheets
 * («ورقة الفقاعات», #58). Bubble sheets use the fixed geometry of JA_BUBBLE_GEOMETRY so the Wave 7
 * OMR reader can locate every bubble from the four corner marks and the QR.
 */

const pad = (n: number, len: number) => String(Math.max(0, Math.floor(n))).padStart(len, '0').slice(-len)

/**
 * Bubble-sheet QR (digits only, like the other control codes):
 *   14 + session(4) + secret(7) + grade code(2) + part(2) + version(1: 1=A, 2=B) + check(1) + sig(6) = 25 digits.
 */
export const JA_BUBBLE_QR_PREFIX = '14'
export function bubbleQrPayload(sessionCode: string, x: { secret: number; gradeCode: number; part: number; version: JaVersion }) {
  const body = JA_BUBBLE_QR_PREFIX + pad(Number(sessionCode) || 0, 4) + pad(x.secret, 7) + pad(x.gradeCode, 2) + pad(x.part, 2) + (x.version === 'B' ? '2' : '1')
  const withCheck = body + luhnDigit(body)
  return withCheck + qrSignature(withCheck)
}

export type JaBubbleQrParse = { ok: true; sessionCode: string; secret: number; gradeCode: number; part: number; version: JaVersion } | { ok: false; reason: 'format' | 'prefix' | 'check' | 'signature' | 'session' }

export function parseBubbleQr(raw: string, sessionCode: string): JaBubbleQrParse {
  const d = String(raw ?? '').trim()
  if (!/^\d{25}$/.test(d)) return { ok: false, reason: 'format' }
  if (!d.startsWith(JA_BUBBLE_QR_PREFIX)) return { ok: false, reason: 'prefix' }
  const withCheck = d.slice(0, 19)
  if (String(luhnDigit(withCheck.slice(0, 18))) !== withCheck[18]) return { ok: false, reason: 'check' }
  if (qrSignature(withCheck) !== d.slice(19)) return { ok: false, reason: 'signature' }
  if (d.slice(2, 6) !== pad(Number(sessionCode) || 0, 4)) return { ok: false, reason: 'session' }
  return { ok: true, sessionCode: d.slice(2, 6), secret: Number(d.slice(6, 13)), gradeCode: Number(d.slice(13, 15)), part: Number(d.slice(15, 17)), version: d[17] === '2' ? 'B' : 'A' }
}

const mm = (v: number) => `${v}mm`

/** «أخطاء الطلبة»: one cut-out line per student (names only after unmasking). */
export async function renderErrorSlips(ctx: JcContext, keyId: string): Promise<{ pdf: Buffer; name: string }> {
  need(ctx.can.manage || ctx.can.entry)
  const st = await keyState(ctx, keyId)
  const settings = await getSettings(ctx.rootId, ctx.session.campus_id)
  const header = await printHeader(ctx.session.campus_id ?? ctx.session.school_id, settings)
  const bySs = new Map(st.sheets.map((r) => [r.session_student_id, r]))
  const grade = (await getGrades(ctx)).find((g) => g.grade_level_id === st.key.grade_level_id)
  const subject = grade?.subjects.find((s) => s.key === st.key.subject_key)
  const lines = st.students
    .map((s) => ({ s, secret: st.secrets.get(s.id)!.secret, sheet: bySs.get(s.id) }))
    .filter((x) => x.sheet)
    .sort((a, b) => a.secret - b.secret)
    .map(({ s, secret, sheet }) => {
      const g = gradeSheet(st.def, sheet!.answers, sheet!.version)
      const items = g.marks
        .map((m, q) => {
          if (m === 'wrong') return `<span class="e">${q + 1}: ${esc(sheet!.answers[q] || '—')} ← ${esc(keyFor(st.def, q, sheet!.version).join('/'))}</span>`
          if (m === 'blank') return `<span class="b">${q + 1}: — ← ${esc(keyFor(st.def, q, sheet!.version).join('/'))}</span>`
          return ''
        })
        .filter(Boolean)
        .join(' ')
      const who = ctx.unmasked ? `${esc(s.name)} — ` : ''
      return `<div class="slip"><div class="h">${who}الرقم السري ${secret} • النموذج ${sheet!.version === 'B' ? 'ب' : 'أ'} • الدرجة ${g.score ?? '—'} / ${st.key.max_score}</div>
        <div class="q">${items || 'لا أخطاء — أحسنت'}</div></div>`
    })
  if (!lines.length) throw new JgError(404, 'No answer sheets entered for this key')
  const body = `${bandHtml(header, 'كنترول جهبذ')}<div class="title">أخطاء الطلبة — ${esc(grade?.grade_level_name ?? '')} — ${esc(subject?.name ?? st.key.subject_key)}${st.key.part_key ? ` — ${esc(st.key.part_key)}` : ''}</div>
    <style>.slip{border-bottom:1px dashed #999;padding:5px 2px;break-inside:avoid}.slip .h{font-weight:700}.slip .q{margin-top:2px;line-height:1.7}.slip .e{color:#b91c1c;margin-inline-end:8px}.slip .b{color:#6b7280;margin-inline-end:8px}</style>
    ${lines.join('')}${footHtml('أخطاء الطلبة')}`
  const pdf = await renderHtmlToPdf(page('أخطاء الطلبة', body, 'portrait', 9.5), { margin: { top: '0', bottom: '0' } })
  await logJc(ctx, 'print', 'document', 'error_slips', null, { key_id: keyId })
  return { pdf, name: 'error-slips.pdf' }
}

/**
 * «ورقة الفقاعات»: one A4 page per student ordered by committee then seat (one committee or all, in
 * batches of 40 via `offset`). Secret number and version pre-bubbled; four corner marks; the QR carries
 * secret-grade-part-version. Confidential (secret numbers): secret-view rights only.
 */
export async function renderBubbleSheets(ctx: JcContext, keyId: string, opts: { committee_id?: string | null; offset?: number }): Promise<{ pdf: Buffer; name: string; total: number }> {
  need(ctx.can.secret, 'Bubble sheets carry secret numbers (control chief / secret role)')
  const st = await keyState(ctx, keyId)
  const [committees, all, grades] = await Promise.all([listCommittees(ctx), loadStudents(ctx), getGrades(ctx)])
  const grade = grades.find((g) => g.grade_level_id === st.key.grade_level_id)
  const subject = grade?.subjects.find((s) => s.key === st.key.subject_key)
  const order = new Map(committees.map((c, i) => [c.id, i]))
  const cname = new Map(committees.map((c) => [c.id, c.name]))
  const list = st.students
    .filter((s) => (!opts.committee_id || s.committee_id === opts.committee_id) && s.committee_id)
    .sort((a, b) => (order.get(a.committee_id!) ?? 0) - (order.get(b.committee_id!) ?? 0) || (a.seat_index ?? 0) - (b.seat_index ?? 0))
  const total = list.length
  const from = Math.max(0, Math.floor(Number(opts.offset ?? 0)))
  const batch = list.slice(from, from + 40)
  if (!batch.length) throw new JgError(404, 'No seated students for these sheets')
  const parts = [...new Set((await listKeys(ctx)).filter((k) => k.grade_level_id === st.key.grade_level_id && k.subject_key === st.key.subject_key).map((k) => k.part_key))].sort()
  const partNo = Math.max(0, parts.indexOf(st.key.part_key))
  const opt = JA_OPTIONS.slice(0, st.key.options)
  const count = Math.min(G.maxQuestions, st.key.question_count)
  const b = G.bubble
  const bubble = (x: number, y: number, label: string, filled = false) =>
    `<div style="position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(b.d)};height:${mm(b.d)};border:0.35mm solid #000;border-radius:50%;${filled ? 'background:#000;' : ''}font-size:2.6mm;line-height:${mm(b.d)};text-align:center;color:${filled ? '#fff' : '#444'}">${esc(label)}</div>`
  const corner = (x: number, y: number) => `<div style="position:absolute;left:${mm(x)};top:${mm(y)};width:${mm(G.corner.size)};height:${mm(G.corner.size)};background:#000"></div>`
  const pages: string[] = []
  for (const [i, s] of batch.entries()) {
    const secret = st.secrets.get(s.id)!.secret
    const version: JaVersion = s.paper_model === 'B' ? 'B' : 'A'
    const qr = await qrSvg(bubbleQrPayload(ctx.session.session_code, { secret, gradeCode: grade?.grade_code ?? 0, part: partNo, version }))
    const cs = G.corner.size
    const ins = G.corner.inset
    let html = corner(ins, ins) + corner(G.page.w - ins - cs, ins) + corner(ins, G.page.h - ins - cs) + corner(G.page.w - ins - cs, G.page.h - ins - cs)
    html += `<div style="position:absolute;left:${mm(G.page.w - 22 - 60)};top:${mm(20)};width:${mm(60)};text-align:right;font-size:3.4mm;line-height:1.5" dir="rtl">
      <div style="font-weight:700">${esc(ctx.session.name)}</div><div>${esc(grade?.grade_level_name ?? '')} — ${esc(subject?.name ?? st.key.subject_key)}${st.key.part_key ? ` — ${esc(st.key.part_key)}` : ''}</div>
      <div>${esc(cname.get(s.committee_id!) ?? '')} • المقعد ${s.seat_index ?? ''} • رقم الجلوس ${s.seat_number ?? ''}</div>
      <div>الرقم السري ${secret} • النموذج ${version === 'B' ? 'ب' : 'أ'}</div></div>`
    html += `<div style="position:absolute;left:${mm(22)};top:${mm(18)};width:${mm(28)};height:${mm(28)}">${qr.replace('<svg', '<svg width="100%" height="100%"')}</div>`
    // Secret-number grid (pre-bubbled), digit columns left to right.
    const digits = secretDigits(secret)
    for (let col = 0; col < G.secret.digits; col++) for (let v = 0; v <= 9; v++) html += bubble(G.secret.start + col * b.gapX, G.secret.top + v * (b.gapY - 1.6), String(v), digits[col] === v)
    html += `<div style="position:absolute;left:${mm(G.secret.start)};top:${mm(G.secret.top - 5)};font-size:2.8mm">الرقم السري</div>`
    html += bubble(G.version.start, G.version.top, 'أ', version === 'A') + bubble(G.version.start + b.gapX, G.version.top, 'ب', version === 'B')
    html += `<div style="position:absolute;left:${mm(G.version.start)};top:${mm(G.version.top - 5)};font-size:2.8mm">النموذج</div>`
    for (let q = 0; q < count; q++) {
      const colBlock = Math.floor(q / G.answers.perColumn)
      const row = q % G.answers.perColumn
      const y = G.answers.top + row * b.gapY
      const x0 = G.answers.start + colBlock * G.answers.columnGap
      html += `<div style="position:absolute;left:${mm(x0 - 8)};top:${mm(y)};width:${mm(7)};font-size:3mm;line-height:${mm(b.d)};text-align:right">${q + 1}</div>`
      opt.forEach((o, k) => (html += bubble(x0 + k * b.gapX, y, o)))
    }
    html += `<div style="position:absolute;left:${mm(22)};top:${mm(G.page.h - 24)};width:${mm(166)};font-size:2.8mm;color:#444;text-align:right" dir="rtl">ظلّل دائرة واحدة لكل سؤال بقلم داكن. لا تكتب خارج الدوائر ولا تطوِ الورقة. التصحيح آلي — جهبذ.</div>`
    pages.push(`<section style="position:relative;width:210mm;height:297mm;overflow:hidden;${i < batch.length - 1 ? 'break-after:page;page-break-after:always;' : ''}">${html}</section>`)
  }
  const doc = page('ورقة الفقاعات', pages.join(''), 'portrait', 10).replace('@page{size:A4 portrait;margin:8mm}', '@page{size:A4 portrait;margin:0}')
  const pdf = await renderHtmlToPdf(doc, { margin: { top: '0', bottom: '0', left: '0', right: '0' } })
  await logJc(ctx, 'print', 'document', 'bubble_sheets', null, { key_id: keyId, committee_id: opts.committee_id ?? null, offset: from, count: batch.length })
  return { pdf, name: 'bubble-sheets.pdf', total }
}
