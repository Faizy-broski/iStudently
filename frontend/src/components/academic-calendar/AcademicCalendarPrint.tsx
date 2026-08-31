'use client'

import React, { useMemo } from 'react'
import type { MarkingPeriod } from '@/lib/api/marking-periods'
import type { SchoolEvent, EventCategory } from '@/lib/api/events'

// ============================================================================
// TYPES
// ============================================================================

export interface CalendarGrade {
  id: string
  name: string
}

export interface AcademicCalendarPrintProps {
  markingPeriods: MarkingPeriod[]
  events: SchoolEvent[]
  /** Selected grade IDs to highlight — empty = school-wide */
  selectedGradeIds: string[]
  gradeLevels: CalendarGrade[]
  schoolName: string
  schoolAddress?: string
  schoolLogoUrl?: string
  /** Day the school week starts (0=Sun,1=Mon,...,6=Sat) */
  weekStartDay?: number
  /** Day the school week ends (0=Sun,...,6=Sat) */
  weekEndDay?: number
  academicYearLabel?: string
}

// ============================================================================
// HELPERS
// ============================================================================

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const SHORT_DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function datesInRange(start: string, end: string): Set<string> {
  const set = new Set<string>()
  let cur = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  while (cur <= endD) {
    set.add(isoDate(cur))
    cur = addDays(cur, 1)
  }
  return set
}

function isWeekend(dateStr: string, weekStartDay: number, weekEndDay: number): boolean {
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  const workdays = new Set<number>()
  let day = weekStartDay
  for (let i = 0; i < 7; i++) {
    workdays.add(day % 7)
    if (day % 7 === weekEndDay) break
    day++
  }
  return !workdays.has(dow)
}

function buildMonthDays(
  year: number,
  month: number,
  weekStartDay: number
): Array<{ date: string; day: number } | null> {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const offset = (firstDay.getDay() - weekStartDay + 7) % 7
  const days: Array<{ date: string; day: number } | null> = []
  for (let i = 0; i < offset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({ date, day: d })
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

const DOT_ONLY: EventCategory[] = ['meeting', 'activity', 'reminder']

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AcademicCalendarPrint({
  markingPeriods,
  events,
  selectedGradeIds,
  gradeLevels,
  schoolName,
  schoolAddress,
  schoolLogoUrl,
  weekStartDay = 0,
  weekEndDay = 4,
  academicYearLabel,
}: AcademicCalendarPrintProps) {

  // Derive calendar span from marking period dates
  const { startMonth, startYear, endMonth, endYear } = useMemo(() => {
    const dates = markingPeriods.flatMap(mp => [mp.start_date, mp.end_date]).filter(Boolean) as string[]
    if (!dates.length) {
      const now = new Date()
      return { startMonth: 8, startYear: now.getFullYear(), endMonth: 5, endYear: now.getFullYear() + 1 }
    }
    dates.sort()
    const first = new Date(dates[0] + 'T00:00:00')
    const last  = new Date(dates[dates.length - 1] + 'T00:00:00')
    return { startMonth: first.getMonth(), startYear: first.getFullYear(), endMonth: last.getMonth(), endYear: last.getFullYear() }
  }, [markingPeriods])

  // Build month list
  const months = useMemo(() => {
    const list: { year: number; month: number }[] = []
    let y = startYear, m = startMonth
    while (y < endYear || (y === endYear && m <= endMonth)) {
      list.push({ year: y, month: m })
      if (++m > 11) { m = 0; y++ }
    }
    return list
  }, [startYear, startMonth, endYear, endMonth])

  // date → events map
  const eventsByDate = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>()
    for (const ev of events) {
      const dates = datesInRange(ev.start_at.slice(0, 10), ev.end_at.slice(0, 10))
      dates.forEach(d => {
        if (!map.has(d)) map.set(d, [])
        map.get(d)!.push(ev)
      })
    }
    return map
  }, [events])

  // Marking period date sets
  const { mpSchoolWide, mpGradeSpecific } = useMemo(() => {
    const mpSchoolWide = new Set<string>()
    const mpGradeSpecific = new Set<string>()
    for (const mp of markingPeriods) {
      if (!mp.start_date || !mp.end_date) continue
      datesInRange(mp.start_date, mp.end_date).forEach(d => mpSchoolWide.add(d))
    }
    if (selectedGradeIds.length > 0) {
      for (const ev of events) {
        if (ev.category === 'academic' && ev.target_grades?.some(g => selectedGradeIds.includes(g))) {
          datesInRange(ev.start_at.slice(0, 10), ev.end_at.slice(0, 10)).forEach(d => mpGradeSpecific.add(d))
        }
      }
    }
    return { mpSchoolWide, mpGradeSpecific }
  }, [markingPeriods, events, selectedGradeIds])

  // Dates to remember
  const datesToRemember = useMemo(() => {
    const items: { label: string; date: string; bold?: boolean }[] = []
    for (const mp of markingPeriods) {
      if (mp.start_date) items.push({ label: `${mp.title} — begins`, date: mp.start_date, bold: true })
      if (mp.end_date)   items.push({ label: `${mp.title} — ends`, date: mp.end_date })
    }
    for (const ev of events) {
      const start = ev.start_at.slice(0, 10)
      const end   = ev.end_at.slice(0, 10)
      const dateLabel = start === end ? start : `${formatDate(start)} – ${formatDate(end)}`
      items.push({ label: ev.title, date: dateLabel, bold: ev.category === 'exam' || ev.category === 'holiday' })
    }
    items.sort((a, b) => {
      const da = a.date.match(/^\d{4}-\d{2}-\d{2}$/) ? a.date : a.date.slice(0, 10)
      const db = b.date.match(/^\d{4}-\d{2}-\d{2}$/) ? b.date : b.date.slice(0, 10)
      return da.localeCompare(db)
    })
    return items
  }, [markingPeriods, events])

  const gradeLabel = useMemo(() => {
    if (!selectedGradeIds.length) return 'All Grades'
    return gradeLevels.filter(g => selectedGradeIds.includes(g.id)).map(g => g.name).join(' & ').toUpperCase()
  }, [selectedGradeIds, gradeLevels])

  const yearLabel = academicYearLabel || `${startYear} / ${endYear}`
  const dayHeaders = Array.from({ length: 7 }, (_, i) => SHORT_DAY_NAMES[(weekStartDay + i) % 7])
  const dayName = (d: number) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d]
  const schoolWeekLabel = `${dayName(weekStartDay)} – ${dayName(weekEndDay)}`

  const col = (all: typeof datesToRemember, ci: number, cols: number) => {
    const size = Math.ceil(all.length / cols)
    return all.slice(ci * size, (ci + 1) * size)
  }

  return (
    <div id="acal-print-root" style={{ fontFamily: 'Arial,sans-serif', background: '#fff', color: '#222', padding: '18px 22px', maxWidth: '1120px', margin: '0 auto', boxSizing: 'border-box' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '3px solid #8B0000', paddingBottom: '8px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {schoolLogoUrl && <img src={schoolLogoUrl} alt="" style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '6px' }} />}
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B0000', lineHeight: 1.15 }}>Academic Calendar &nbsp; {yearLabel}</div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#a16207', marginTop: '2px', letterSpacing: '0.07em' }}>{gradeLabel}</div>
            <div style={{ fontSize: '10px', color: '#555', marginTop: '3px' }}>{[schoolName, schoolAddress].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px', color: '#555' }}>
          <div style={{ fontWeight: 'bold' }}>School week</div>
          <div>{schoolWeekLabel}</div>
        </div>
      </div>

      {/* MONTHLY GRIDS */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length <= 10 ? 5 : 6}, 1fr)`, gap: '8px 12px', marginBottom: '10px' }}>
        {months.map(({ year, month }) => {
          const days = buildMonthDays(year, month, weekStartDay)
          return (
            <div key={`${year}-${month}`}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '3px' }}>{MONTH_NAMES[month]} {year}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '1px', marginBottom: '2px' }}>
                {dayHeaders.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '8.5px', color: '#888', fontWeight: 'bold' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '1px' }}>
                {days.map((cell, i) => {
                  if (!cell) return <div key={i} />
                  const { date, day } = cell
                  const evs = eventsByDate.get(date) || []
                  const weekend   = isWeekend(date, weekStartDay, weekEndDay)
                  const isHoliday = evs.some(e => e.category === 'holiday')
                  const isExam    = evs.some(e => e.category === 'exam')
                  const hasDot    = evs.some(e => DOT_ONLY.includes(e.category))
                  const inGrade   = mpGradeSpecific.has(date)
                  const inSchool  = mpSchoolWide.has(date)

                  let bg = 'transparent', fg = '#222', fw: 'normal'|'bold' = 'normal'
                  if (weekend)   { bg = '#e5e7eb'; fg = '#9ca3af' }
                  if (inSchool)  { bg = '#bbf7d0'; fg = '#14532d' }
                  if (inGrade)   { bg = '#86efac'; fg = '#14532d' }
                  if (isHoliday) { bg = '#fed7aa'; fg = '#c2410c'; fw = 'bold' }
                  if (isExam)    { bg = '#fecaca'; fg = '#991b1b'; fw = 'bold' }

                  return (
                    <div key={date} style={{ position: 'relative', background: bg, color: fg, fontWeight: fw, fontSize: '9px', textAlign: 'center', borderRadius: '2px', lineHeight: '14px', minHeight: '14px' }}>
                      {day}
                      {hasDot && <span style={{ position: 'absolute', bottom: '1px', left: '50%', transform: 'translateX(-50%)', width: '3px', height: '3px', borderRadius: '50%', background: '#374151', display: 'block' }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* LEGEND */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '9.5px', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', padding: '4px 0', marginBottom: '8px', flexWrap: 'wrap' }}>
        <LegItem color="#86efac" label="Grade-specific period" />
        <LegItem color="#bbf7d0" label="School-wide period" />
        <LegItem color="#e5e7eb" label="Weekend" />
        <LegItem color="#fed7aa" label="Holiday / Ramadan / Eid" />
        <LegItem color="#fecaca" label="Exams — no classes" />
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#374151', display: 'inline-block' }} />
          School event
        </span>
      </div>

      {/* DATES TO REMEMBER */}
      <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '6px 10px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#8B0000', marginBottom: '5px', borderBottom: '1px solid #e5e7eb', paddingBottom: '3px' }}>Dates to remember</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0 16px' }}>
          {[0, 1, 2].map(ci => (
            <div key={ci}>
              {col(datesToRemember, ci, 3).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', padding: '1px 0', borderBottom: '1px dotted #f3f4f6', gap: '6px' }}>
                  <span style={{ fontWeight: item.bold ? 'bold' : 'normal', color: '#374151', flex: '1', minWidth: 0 }}>{item.label}</span>
                  <span style={{ color: item.bold ? '#111' : '#6b7280', fontWeight: item.bold ? 'bold' : 'normal', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {item.date.match(/^\d{4}-\d{2}-\d{2}$/) ? formatDate(item.date) : item.date}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LegItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '13px', height: '9px', background: color, border: '1px solid #d1d5db', borderRadius: '2px', display: 'inline-block' }} />
      {label}
    </span>
  )
}
