import type { TimetableEntry } from '@/lib/api/timetable'
import type { GlobalPeriod } from '@/lib/api/teachers'

// ============================================================================
// TIMETABLE EXPORT HELPERS (CSV) — shared by per-section / per-teacher /
// per-room views in the generator's review step. Print is handled via the
// `.print-area` CSS helper in globals.css + window.print(), not here.
// ============================================================================

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Builds a periods (rows) x days (columns) grid CSV for a given set of
 * already-filtered entries — works for a section view (cell = subject +
 * teacher), a teacher view (cell = section + subject), or a room view
 * (cell = section + subject + teacher), depending on `cellLabel`.
 */
export function exportTimetableGridCSV(params: {
  title: string
  entries: TimetableEntry[]
  periods: GlobalPeriod[]
  cellLabel: (entry: TimetableEntry) => string
  filename: string
}) {
  const { title, entries, periods, cellLabel, filename } = params
  const sortedPeriods = [...periods].sort((a, b) => a.sort_order - b.sort_order)
  const days = DAY_LABELS.slice(0, 5)

  const lines: string[] = []
  lines.push(csvEscape(title))
  lines.push('')
  lines.push(['Period', 'Time', ...days].map(csvEscape).join(','))

  sortedPeriods.forEach(period => {
    const periodName = period.title || period.short_name || `P${period.sort_order}`
    const timeRange = period.start_time && period.end_time ? `${period.start_time}-${period.end_time}` : ''
    const row = [periodName, timeRange]
    days.forEach((_, dayIdx) => {
      const entry = entries.find(e => e.day_of_week === dayIdx && e.period_id === period.id)
      row.push(entry ? cellLabel(entry) : '-')
    })
    lines.push(row.map(csvEscape).join(','))
  })

  downloadCSV(filename, lines.join('\n'))
}

export function sectionCellLabel(entry: TimetableEntry): string {
  const room = entry.room_number ? ` [${entry.room_number}]` : ''
  return `${entry.subject_name || 'Subject'} (${entry.teacher_name || 'Teacher'})${room}`
}

export function teacherCellLabel(entry: TimetableEntry): string {
  const room = entry.room_number ? ` [${entry.room_number}]` : ''
  return `${entry.section_name || 'Section'} - ${entry.subject_name || 'Subject'}${room}`
}

export function roomCellLabel(entry: TimetableEntry): string {
  return `${entry.section_name || 'Section'} - ${entry.subject_name || 'Subject'} (${entry.teacher_name || 'Teacher'})`
}

/** Triggers the browser print dialog, scoped to whatever element carries the
 * `print-area` class via the CSS in globals.css. */
export function printCurrentTimetable() {
  window.print()
}
