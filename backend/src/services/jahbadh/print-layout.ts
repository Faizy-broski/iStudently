import { createHmac } from 'node:crypto'

import QRCode from 'qrcode'

import { escapeHtml as esc } from '../../utils/html-pdf.util'
import type { JgSettings } from './grades.service'

/**
 * Page layout shared by the Wave 2 prints (brief A2): every sheet is one A4 page, centred horizontally
 * and vertically, scaled down (never cut) when its content is taller or wider than the page and, when
 * allowed, scaled up a little to fill it. The sizing runs in the page itself (Chromium), after layout.
 */

/** Printable area inside the 8 mm @page margin of print.service `page()`, minus 2 mm of safety. */
const AREA = { portrait: { w: 192, h: 279 }, landscape: { w: 279, h: 192 } }

export interface SheetOpts {
  orientation?: 'portrait' | 'landscape'
  /** Largest scale-up to fill the page (1 = never enlarge). */
  grow?: number
}

/** One A4 page: content centred and fitted (see FIT_SCRIPT). */
export function sheet(inner: string, opts: SheetOpts = {}, last = false): string {
  const a = AREA[opts.orientation ?? 'portrait']
  return `<section class="jg-sheet" data-grow="${opts.grow ?? 1}" style="width:${a.w}mm;height:${a.h}mm;margin:0 auto;display:flex;align-items:center;justify-content:center;overflow:hidden;${last ? '' : 'break-after:page;page-break-after:always;'}"><div class="jg-fit" style="width:${a.w}mm">${inner}</div></section>`
}

/** Several sheets in a row (each its own page). */
export const sheets = (inners: string[], opts: SheetOpts = {}) => inners.map((x, i) => sheet(x, opts, i === inners.length - 1)).join('')

/**
 * Runs once the DOM is ready and again when the embedded font has loaded: every `.jg-fit` gets the
 * zoom that makes it fit its `.jg-sheet` (≤ data-grow). Zoom (not transform) so the PDF reflows.
 */
export const FIT_SCRIPT = `<script>(function(){function fit(){document.querySelectorAll('.jg-sheet').forEach(function(s){var f=s.firstElementChild;if(!f)return;f.style.zoom='1';var g=parseFloat(s.getAttribute('data-grow')||'1');var k=Math.min(g,(s.clientHeight*0.985)/Math.max(f.scrollHeight,1),(s.clientWidth*0.985)/Math.max(f.scrollWidth,1));f.style.zoom=String(Math.max(0.3,k));});}fit();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fit);})();</script>`

/** «89.86%» — two decimals, as on the official card (brief B7). */
export function fmtPct2(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—'
  return `${(Math.round(p * 10000) / 100).toFixed(2)}%`
}

/** «للعام الدراسي 1447 / 1448 هـ الموافق 2025 - 2026 م» (Hijri year from the school settings). */
export function yearLine(settings: JgSettings, yearName: string | null): string {
  const hijri = (settings.header?.hijri_year ?? '').trim()
  const greg = (yearName ?? '').trim()
  if (hijri && greg) return `للعام الدراسي ${hijri} هـ الموافق ${greg} م`
  if (greg) return `للعام الدراسي ${greg} م`
  return hijri ? `للعام الدراسي ${hijri} هـ` : ''
}

/** School identity fields kept in jg_settings.header (brief B6-24). */
export function schoolExtras(settings: JgSettings) {
  const h = settings.header ?? {}
  return {
    schoolNumber: (h.school_number ?? '').trim(),
    locatedAt: (h.located_at ?? '').trim(),
    examsCoordinator: (h.exams_coordinator ?? '').trim(),
    subOffice: (h.sub_office ?? '').trim(),
  }
}

/** 8 digits of HMAC(server secret, text); '' when no secret is configured (development). */
export function signCode(text: string): string {
  const secret = process.env.JC_QR_SECRET || process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret) return ''
  const hex = createHmac('sha256', secret).update(`jahbadh-card|${text}`).digest('hex')
  return BigInt(`0x${hex}`).toString().slice(0, 8)
}

/** Card reference «school no. – registration no. – print date» (brief B7). */
export function cardReference(schoolNumber: string, registration: string, printedOn: Date = new Date()): string {
  const d = printedOn.toISOString().slice(0, 10).replace(/-/g, '')
  return [schoolNumber || '0', registration || '0', d].join('-')
}

export async function qrSvgOf(payload: string, sizeMm = 18): Promise<string> {
  const svg = await QRCode.toString(payload, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 })
  return svg.replace('<svg ', `<svg style="width:${sizeMm}mm;height:${sizeMm}mm" `)
}

/** Dashed «✂» cut line between two half-page slips. */
export const cutLine = '<div style="margin:5mm 0;border-top:1.5px dashed #9AA8BF;position:relative;text-align:center;font-size:9px;color:#5B6B82"><span style="position:relative;top:-7px;background:#fff;padding:0 6px">✂</span></div>'

/** Signature boxes: label, then the name (if known) and a dotted line. */
export function signatureRow(items: [string, string?][]): string {
  return `<div style="display:flex;gap:10px;margin-top:6px">${items
    .map(([label, name]) => `<div style="flex:1;text-align:center"><div style="font-weight:700">${esc(label)}</div>${name ? `<div>${esc(name)}</div>` : ''}<div class="muted">..........................</div></div>`)
    .join('')}</div>`
}
