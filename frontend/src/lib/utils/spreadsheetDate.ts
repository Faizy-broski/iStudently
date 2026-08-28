/**
 * Normalizes a raw spreadsheet cell value into a Postgres-friendly
 * YYYY-MM-DD date string, for CSV/Excel bulk-import flows.
 *
 * Handles:
 *  - JS Date objects (from SheetJS's `cellDates: true` on a properly
 *    date-formatted Excel cell)
 *  - Excel/Lotus serial-date numbers — days since 1899-12-30 — which
 *    SheetJS returns instead of a Date for numeric-formatted date cells,
 *    or for any cell when `cellDates` isn't set. Without this, a value
 *    like 43719 gets stringified as-is and rejected by Postgres's `date`
 *    column type.
 *  - Common textual date formats (already-ISO, and D/M/Y or M/D/Y with
 *    /, -, or . separators)
 *
 * Returns undefined if the value is empty or can't be confidently parsed.
 */
export function normalizeSpreadsheetDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : toIsoDate(value)
  }

  const str = String(value).trim()
  if (!str) return undefined

  // Already ISO (YYYY-MM-DD), possibly with a time suffix
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  // Bare integer (optionally with a fractional time-of-day part) in the
  // plausible Excel serial-date range — roughly the years 1901-2200.
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = parseFloat(str)
    if (serial > 1 && serial < 120000) {
      const ms = Math.round((serial - 25569) * 86400 * 1000)
      const d = new Date(ms)
      if (!isNaN(d.getTime())) return toIsoDate(d)
    }
    return undefined
  }

  // D/M/Y or M/D/Y, with /, -, or . separators
  const partsMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (partsMatch) {
    const [, a, b, yearStr] = partsMatch
    let month = parseInt(a, 10)
    let day = parseInt(b, 10)
    // If the first number can't be a month, it must be a day (DD/MM/YYYY).
    if (month > 12 && day <= 12) [month, day] = [day, month]
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(parseInt(yearStr, 10), month - 1, day))
      if (!isNaN(d.getTime())) return toIsoDate(d)
    }
    return undefined
  }

  // Last resort: things like "Jan 5, 2010"
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) return toIsoDate(parsed)

  return undefined
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
