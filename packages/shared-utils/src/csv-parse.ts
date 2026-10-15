/**
 * Parses CSV text (RFC 4180: quoted fields, "" escapes, newlines inside quotes, CRLF/LF, UTF-8 BOM).
 * Also accepts ; or tab separated files (Excel in some locales), detected from the header line.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.slice(0, src.search(/\r?\n|$/))
  const sep = [',', ';', '\t'].map((s) => [s, firstLine.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"' && field === '') quoted = true
    else if (c === sep) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

/** Rows as objects keyed by the (trimmed, lower-cased) header line. */
export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [head = [], ...body] = parseCsv(text)
  const headers = head.map((h) => h.trim())
  const keys = headers.map((h) => h.toLowerCase())
  return { headers, rows: body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()]))) }
}
