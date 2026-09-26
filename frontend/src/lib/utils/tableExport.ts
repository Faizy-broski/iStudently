/**
 * Reusable Excel/PDF export for tabular data — generalizes the pattern first
 * proven in grievance-export.ts (xlsx + jspdf/jspdf-autotable) into a
 * column-config-driven exporter any table/list screen can use via the
 * shared <ExportButton> component (components/shared/ExportButton.tsx).
 *
 * Deliberately client-side and data-driven (never DOM rasterization): builds
 * the file straight from `rows` + `columns`, so — unlike printLayout.ts's
 * html2canvas-based PDF path — it works the same whether the triggering
 * button lives on a plain page or inside a Radix Dialog/portal (see
 * AcademicCalendarExportButton.tsx for the iframe workaround that approach
 * needed and that this one avoids entirely).
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { qrToPngDataUrl } from './qrImage'

// jsPDF's built-in fonts (helvetica/times/courier) only cover WinAnsi —
// any Arabic text drawn with them comes out as mojibake (bytes reinterpreted
// as the wrong Latin-1-ish glyphs), regardless of the *UI's* locale, since
// the underlying row data (e.g. a student's name) can be Arabic even when
// the admin exporting it is viewing the English UI. Noto Sans Arabic covers
// both Arabic and Latin, so it's loaded once and used for every PDF export
// rather than trying to detect "is this Arabic" per field.
const ARABIC_FONT_URL = '/fonts/NotoSansArabic-Regular.ttf'
export const ARABIC_FONT_NAME = 'NotoSansArabic'
let arabicFontBase64Promise: Promise<string> | null = null

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function loadArabicFontBase64(): Promise<string> {
  if (!arabicFontBase64Promise) {
    arabicFontBase64Promise = fetch(ARABIC_FONT_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${ARABIC_FONT_URL}: ${res.status}`)
        return res.arrayBuffer()
      })
      .then(arrayBufferToBase64)
      .catch((err) => {
        arabicFontBase64Promise = null // allow retry on the next export
        throw err
      })
  }
  return arabicFontBase64Promise
}

/**
 * Embeds the bundled Arabic/Latin font into a jsPDF document and switches to
 * it, so both English and Arabic table content render correctly. Falls back
 * to jsPDF's default font (Arabic will be unreadable, but the export still
 * succeeds) if the font file can't be fetched for some reason.
 */
export async function useUnicodeFont(pdf: jsPDF): Promise<void> {
  try {
    const base64 = await loadArabicFontBase64()
    pdf.addFileToVFS(`${ARABIC_FONT_NAME}.ttf`, base64)
    pdf.addFont(`${ARABIC_FONT_NAME}.ttf`, ARABIC_FONT_NAME, 'normal')
    pdf.setFont(ARABIC_FONT_NAME)
  } catch (err) {
    console.error('Falling back to default PDF font — Arabic text will not render correctly:', err)
  }
}

/** One column to include in an export — the shape <ExportButton> and export templates share. */
export interface ExportColumn<T = Record<string, unknown>> {
  /** Stable identifier, matched against export_templates.columns[].key. */
  key: string
  /** Column header shown in the export. */
  label: string
  /** Arabic header, used instead of `label` when the export is generated in Arabic. */
  label_ar?: string
  /**
   * Pulls this column's display value out of one row. Defaults to
   * `String(row[key] ?? '')`. `index` is the row's position within the
   * exported set (0-based) — used by `serialNumberColumn()` below for an
   * S.N/# column; most accessors can ignore it.
   */
  accessor?: (row: T, index: number) => string | number | null | undefined
  /**
   * Makes this a QR-code column: returns the text to encode for a row (null/empty = no code).
   * Drawn as an image in the PDF; the Excel export leaves the column out, since the spreadsheet
   * library used here can't embed images. The accessor is not used for such a column.
   */
  qr?: (row: T, index: number) => string | null | undefined
}

/**
 * A ready-made "S.N" / serial-number export column — numbers each row by
 * its position in the exported set. Pass `startAt` to continue numbering
 * across pages (e.g. `(currentPage - 1) * pageSize + 1`) so it matches an
 * on-screen "#" column that does the same; omitted, numbering restarts at 1
 * for whatever rows are actually being exported.
 */
export function serialNumberColumn<T>(startAt: number = 1): ExportColumn<T> {
  return {
    key: '_sn',
    label: 'S.N',
    label_ar: 'م',
    accessor: (_row, index) => startAt + index,
  }
}

/** Minimal branding info for the PDF header — same shape as printLayout.ts's PrintSchool. */
export interface ExportBranding {
  name?: string
  logo_url?: string | null
}

function resolveLabel(col: ExportColumn<any>, locale: 'en' | 'ar'): string {
  return locale === 'ar' && col.label_ar ? col.label_ar : col.label
}

function resolveValue<T>(col: ExportColumn<T>, row: T, index: number): string {
  const raw = col.accessor ? col.accessor(row, index) : (row as Record<string, unknown>)[col.key]
  return raw === null || raw === undefined ? '' : String(raw)
}

function toRows<T>(columns: ExportColumn<T>[], rows: T[]): string[][] {
  return rows.map((row, index) => columns.map((col) => resolveValue(col, row, index)))
}

export interface ExportPdfOptions {
  title?: string
  branding?: ExportBranding
  locale?: 'en' | 'ar'
  orientation?: 'portrait' | 'landscape'
}

export async function exportRowsToPdf<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
  options: ExportPdfOptions = {}
): Promise<void> {
  const { title, branding, locale = 'en', orientation = columns.length > 6 ? 'landscape' : 'portrait' } = options
  const pdf = new jsPDF({ orientation })
  await useUnicodeFont(pdf)
  const pageWidth = pdf.internal.pageSize.getWidth()

  let cursorY = 15
  if (branding?.name) {
    pdf.setFontSize(11)
    pdf.setTextColor(100)
    pdf.text(branding.name, pageWidth / 2, cursorY, { align: 'center' })
    cursorY += 7
  }
  if (title) {
    pdf.setFontSize(14)
    pdf.setTextColor(20)
    pdf.text(title, pageWidth / 2, cursorY, { align: 'center' })
    cursorY += 6
  }

  const head = [columns.map((c) => resolveLabel(c, locale))]
  const body = toRows(columns, rows)

  // QR columns: build every PNG up front (autoTable draws synchronously), then paint them into
  // their cells after each one is laid out.
  const qrColumnIndexes = columns.map((c, i) => (c.qr ? i : -1)).filter((i) => i >= 0)
  const qrImages = new Map<string, string>() // "row:col" -> PNG data URL
  if (qrColumnIndexes.length > 0) {
    const jobs: Array<() => Promise<void>> = []
    rows.forEach((row, r) => {
      for (const c of qrColumnIndexes) {
        const payload = columns[c].qr!(row, r)
        if (payload) jobs.push(async () => { qrImages.set(`${r}:${c}`, await qrToPngDataUrl(payload)) })
      }
    })
    for (let i = 0; i < jobs.length; i += 20) await Promise.all(jobs.slice(i, i + 20).map((j) => j()))
  }
  const QR_MM = 20

  autoTable(pdf, {
    head,
    body,
    startY: cursorY + 3,
    // jspdf-autotable defaults to its own built-in font unless told
    // otherwise — pass the embedded Arabic/Latin font explicitly for both
    // the header row and body cells, not just the title text above. Only the
    // 'normal' weight of that font was registered (addFont above), but
    // autoTable's header defaults to fontStyle 'bold' — without pinning it
    // back to 'normal' here, jsPDF can't find a "NotoSansArabic bold" and
    // silently falls back to its built-in font for header cells, which
    // would reintroduce mojibake for any Arabic column label.
    styles: { fontSize: 8, halign: locale === 'ar' ? 'right' : 'left', font: ARABIC_FONT_NAME },
    headStyles: { fillColor: [2, 33, 114], font: ARABIC_FONT_NAME, fontStyle: 'normal' }, // #022172 — the app's brand navy
    didParseCell: (data) => {
      // Tall enough for the code, and a fixed width so the column doesn't stretch the table.
      if (data.section === 'body' && qrColumnIndexes.includes(data.column.index)) {
        data.cell.styles.minCellHeight = QR_MM + 4
        data.cell.styles.cellWidth = QR_MM + 4
        data.cell.styles.valign = 'middle'
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || !qrColumnIndexes.includes(data.column.index)) return
      const image = qrImages.get(`${data.row.index}:${data.column.index}`)
      if (!image) return
      pdf.addImage(image, 'PNG', data.cell.x + 2, data.cell.y + 2, QR_MM, QR_MM)
    },
  })

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}

export function exportRowsToExcel<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
  options: { locale?: 'en' | 'ar'; sheetName?: string } = {}
): void {
  const { locale = 'en', sheetName = 'Export' } = options
  columns = columns.filter((c) => !c.qr)
  const header = columns.map((c) => resolveLabel(c, locale))
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...toRows(columns, rows)])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/**
 * Excel export that also embeds QR-code columns as real images. SheetJS (used by
 * exportRowsToExcel) can't hold images, so when a column has `qr` this builds the workbook
 * with exceljs instead — loaded on demand so reports without QR columns pay nothing and are
 * exported exactly as before.
 */
export async function exportRowsToExcelAsync<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
  options: { locale?: 'en' | 'ar'; sheetName?: string } = {}
): Promise<void> {
  if (!columns.some((c) => c.qr)) {
    exportRowsToExcel(columns, rows, filename, options)
    return
  }
  const { locale = 'en', sheetName = 'Export' } = options
  const ExcelJS = (await import('exceljs')).default

  const qrImages = new Map<string, string>() // "row:col" -> PNG data URL
  const jobs: Array<() => Promise<void>> = []
  rows.forEach((row, r) => {
    columns.forEach((col, c) => {
      const payload = col.qr?.(row, r)
      if (payload) jobs.push(async () => { qrImages.set(`${r}:${c}`, await qrToPngDataUrl(payload)) })
    })
  })
  for (let i = 0; i < jobs.length; i += 20) await Promise.all(jobs.slice(i, i + 20).map((j) => j()))

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: locale === 'ar' }] })
  sheet.addRow(columns.map((c) => resolveLabel(c, locale)))
  sheet.getRow(1).font = { bold: true }
  rows.forEach((row, r) => {
    sheet.addRow(columns.map((col, c) => (col.qr ? '' : resolveValue(col, row, r))))
    if (columns.some((col, c) => qrImages.has(`${r}:${c}`))) sheet.getRow(r + 2).height = 78 // points
  })
  columns.forEach((col, c) => {
    sheet.getColumn(c + 1).width = col.qr ? 16 : Math.min(40, Math.max(12, resolveLabel(col, locale).length + 4))
  })

  qrImages.forEach((dataUrl, key) => {
    const [r, c] = key.split(':').map(Number)
    const imageId = workbook.addImage({ base64: dataUrl, extension: 'png' })
    // 0-based anchors: row 0 is the header, so data row r sits at r + 1.
    sheet.addImage(imageId, { tl: { col: c + 0.1, row: r + 1 + 0.1 }, ext: { width: 96, height: 96 } })
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  )
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
