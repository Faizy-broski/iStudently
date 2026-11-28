/** CSV download that Excel opens safely: UTF-8 BOM (Arabic) and no formula injection. */
export type CsvCell = string | number | boolean | null | undefined

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function buildCsv(header: string[], rows: CsvCell[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, header: string[], rows: CsvCell[][]) {
  const url = URL.createObjectURL(new Blob([buildCsv(header, rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
