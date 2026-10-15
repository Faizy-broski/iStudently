export type CsvCell = string | number | boolean | null | undefined

/** One CSV field: quoted when needed; cells starting with = + - @ get a ' so spreadsheets don't run them as formulas. */
function cell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s) && typeof value !== 'number') s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV text with a UTF-8 BOM, so Excel shows Arabic correctly (same as the web export). */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

const xmlEscape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)

/**
 * One-sheet Excel workbook (SpreadsheetML 2003, opens in Excel/Numbers/Sheets as .xls) — for the
 * app's "Export Excel" buttons without bundling a spreadsheet library. Numbers stay numeric.
 */
export function toExcelXml(sheetName: string, header: string[], rows: CsvCell[][]): string {
  const cellXml = (v: CsvCell) =>
    typeof v === 'number' && Number.isFinite(v)
      ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${xmlEscape(v === null || v === undefined ? '' : String(v))}</Data></Cell>`
  const rowXml = (r: CsvCell[]) => `<Row>${r.map(cellXml).join('')}</Row>`
  return (
    '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    `<Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31))}"><Table>${[header, ...rows].map(rowXml).join('')}</Table></Worksheet></Workbook>`
  )
}
