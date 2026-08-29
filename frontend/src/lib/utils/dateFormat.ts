import { format, parseISO, type Locale } from 'date-fns'

export const PREFERRED_DATE_FORMAT_KEY = 'studently_preferred_date_format'
export const DEFAULT_DATE_FORMAT = 'MMMM d yyyy'

export interface DateFormatOption {
  value: string
  label: string
  example: string
}

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  { value: 'MMMM d yyyy', label: 'August 26 2026', example: 'August 26 2026' },
  { value: 'MMM d yy', label: 'Aug 26 26', example: 'Aug 26 26' },
  { value: 'd MMMM yyyy', label: '26 August 2026', example: '26 August 2026' },
  { value: 'd MMM yy', label: '26 Aug 26', example: '26 Aug 26' },
  { value: 'MM/dd/yyyy', label: '08/26/2026', example: '08/26/2026' },
  { value: 'dd/MM/yyyy', label: '26/08/2026', example: '26/08/2026' },
  { value: 'yyyy/MM/dd', label: '2026/08/26', example: '2026/08/26' },
  { value: 'dd.MM.yyyy', label: '26.08.2026', example: '26.08.2026' },
  { value: 'dd-MM-yyyy', label: '26-08-2026', example: '26-08-2026' },
  { value: 'yyyy-MM-dd', label: '2026-08-26', example: '2026-08-26' },
]

export function getPreferredDateFormat(): string {
  if (typeof window === 'undefined') return DEFAULT_DATE_FORMAT
  return localStorage.getItem(PREFERRED_DATE_FORMAT_KEY) || DEFAULT_DATE_FORMAT
}

export function setPreferredDateFormat(pattern: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PREFERRED_DATE_FORMAT_KEY, pattern)
  window.dispatchEvent(new CustomEvent('preferred-date-format-changed', { detail: pattern }))
}

export function formatDateWithPreference(
  dateInput?: Date | string | number | null,
  overridePattern?: string,
  locale?: Locale
): string {
  if (!dateInput) return ''
  try {
    let dateObj: Date
    if (typeof dateInput === 'string') {
      dateObj = parseISO(dateInput)
      if (isNaN(dateObj.getTime())) dateObj = new Date(dateInput)
    } else if (typeof dateInput === 'number') {
      dateObj = new Date(dateInput)
    } else {
      dateObj = dateInput
    }

    if (isNaN(dateObj.getTime())) return ''

    const pattern = overridePattern || getPreferredDateFormat()
    return format(dateObj, pattern, locale ? { locale } : undefined)
  } catch {
    return ''
  }
}
