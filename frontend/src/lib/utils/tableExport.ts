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

/** One column to include in an export — the shape <ExportButton> and export templates share. */
export interface ExportColumn<T = Record<string, unknown>> {
  /** Stable identifier, matched against export_templates.columns[].key. */
  key: string
  /** Column header shown in the export. */
  label: string
  /** Arabic header, used instead of `label` when the export is generated in Arabic. */
  label_ar?: string
  /** Pulls this column's display value out of one row. Defaults to `String(row[key] ?? '')`. */
  accessor?: (row: T) => string | number | null | undefined
}

/** Minimal branding info for the PDF header — same shape as printLayout.ts's PrintSchool. */
export interface ExportBranding {
  name?: string
  logo_url?: string | null
}

function resolveLabel(col: ExportColumn<any>, locale: 'en' | 'ar'): string {
  return locale === 'ar' && col.label_ar ? col.label_ar : col.label
}

function resolveValue<T>(col: ExportColumn<T>, row: T): string {
  const raw = col.accessor ? col.accessor(row) : (row as Record<string, unknown>)[col.key]
  return raw === null || raw === undefined ? '' : String(raw)
}

function toRows<T>(columns: ExportColumn<T>[], rows: T[]): string[][] {
  return rows.map((row) => columns.map((col) => resolveValue(col, row)))
}

export interface ExportPdfOptions {
  title?: string
  branding?: ExportBranding
  locale?: 'en' | 'ar'
  orientation?: 'portrait' | 'landscape'
}

export function exportRowsToPdf<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
  options: ExportPdfOptions = {}
): void {
  const { title, branding, locale = 'en', orientation = columns.length > 6 ? 'landscape' : 'portrait' } = options
  const pdf = new jsPDF({ orientation })
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

  autoTable(pdf, {
    head,
    body,
    startY: cursorY + 3,
    styles: { fontSize: 8, halign: locale === 'ar' ? 'right' : 'left' },
    headStyles: { fillColor: [2, 33, 114] }, // #022172 — the app's brand navy
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
  const header = columns.map((c) => resolveLabel(c, locale))
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...toRows(columns, rows)])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
