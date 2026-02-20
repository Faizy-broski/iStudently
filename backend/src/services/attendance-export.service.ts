import ExcelJS from 'exceljs'
import { supabase } from '../config/supabase'
import { AttendanceSheetParams } from '../types'

// ============================================================================
// ATTENDANCE EXPORT SERVICE
// Generates XLS attendance sheets (REPORTS > Print Attendance Sheets)
// Pre-filled with recorded data when available
// Admin only
// ============================================================================

/**
 * Generate an attendance sheet Excel workbook
 * Returns a Buffer that can be sent as a download
 */
export const generateAttendanceSheet = async (
  params: AttendanceSheetParams
): Promise<{ buffer: Buffer; filename: string }> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Studently'
  workbook.created = new Date()

  // Get students
  let studentQuery = supabase
    .from('students')
    .select(`
      id,
      admission_number,
      profiles!inner(first_name, last_name),
      sections!inner(name, grades!inner(name))
    `)
    .eq('school_id', params.school_id)
    .eq('is_active', true)
    .order('profiles(last_name)', { ascending: true })

  if (params.campus_id) {
    studentQuery = studentQuery.eq('campus_id', params.campus_id)
  }

  if (params.section_id) {
    studentQuery = studentQuery.eq('section_id', params.section_id)
  } else if (params.grade_id) {
    const { data: sections } = await supabase
      .from('sections')
      .select('id')
      .eq('grade_id', params.grade_id)
    if (sections && sections.length > 0) {
      studentQuery = studentQuery.in('section_id', sections.map(s => s.id))
    }
  }

  const { data: students } = await studentQuery

  if (!students || students.length === 0) {
    throw new Error('No students found for the given filters')
  }

  // Get periods
  let periodsQuery = supabase
    .from('periods')
    .select('id, period_name, period_number, start_time, end_time, length_minutes')
    .eq('school_id', params.school_id)
    .eq('is_active', true)
    .eq('is_break', false)
    .order('period_number', { ascending: true })

  if (params.campus_id) {
    periodsQuery = periodsQuery.or(`campus_id.eq.${params.campus_id},campus_id.is.null`)
  }

  const { data: periods } = await periodsQuery

  if (!periods || periods.length === 0) {
    throw new Error('No periods configured for this school')
  }

  // Get attendance codes
  let codesQuery = supabase
    .from('attendance_codes')
    .select('id, short_name, state_code, color')
    .eq('school_id', params.school_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (params.campus_id) {
    codesQuery = codesQuery.or(`campus_id.eq.${params.campus_id},campus_id.is.null`)
  }

  const { data: codes } = await codesQuery

  // Generate dates between start and end (only weekdays)
  const dates: string[] = []
  const start = new Date(params.start_date)
  const end = new Date(params.end_date)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      dates.push(d.toISOString().split('T')[0])
    }
  }

  // Get existing attendance data if pre-fill is requested
  let attendanceMap = new Map<string, string>() // key: `studentId:date:periodId` -> code short_name
  if (params.include_data !== false) {
    const studentIds = students.map(s => s.id)

    let recQ = supabase
      .from('attendance_records')
      .select(`
        student_id,
        attendance_date,
        status,
        attendance_code_id,
        attendance_codes(short_name),
        timetable_entries!inner(period_id)
      `)
      .in('student_id', studentIds)
      .gte('attendance_date', params.start_date)
      .lte('attendance_date', params.end_date)
    if (params.campus_id) recQ = recQ.eq('campus_id', params.campus_id)
    const { data: records } = await recQ

    for (const rec of (records || []) as any[]) {
      const periodId = rec.timetable_entries?.period_id
      if (!periodId) continue
      const codeName = rec.attendance_codes?.short_name || rec.status?.[0]?.toUpperCase() || ''
      const key = `${rec.student_id}:${rec.attendance_date}:${periodId}`
      attendanceMap.set(key, codeName)
    }
  }

  // Create one sheet per date (or group dates if too many)
  const sheetsPerWorkbook = dates.length <= 5
  if (sheetsPerWorkbook) {
    // One sheet per date
    for (const date of dates) {
      const dateLabel = new Date(date).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
      })
      const sheet = workbook.addWorksheet(dateLabel)
      buildDailySheet(sheet, students, periods, codes || [], date, attendanceMap)
    }
  } else {
    // Summary sheet with all dates
    const sheet = workbook.addWorksheet('Attendance Sheet')
    buildRangeSheet(sheet, students, periods, codes || [], dates, attendanceMap)
  }

  // Legend sheet
  const legendSheet = workbook.addWorksheet('Legend')
  buildLegendSheet(legendSheet, codes || [])

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  // Build filename
  const sectionName = (students[0] as any).sections?.name || 'all'
  const gradeName = (students[0] as any).sections?.grades?.name || ''
  const filename = `Attendance_${gradeName}_${sectionName}_${params.start_date}_to_${params.end_date}.xlsx`

  return { buffer: Buffer.from(buffer), filename }
}

// ============================================================================
// SHEET BUILDERS
// ============================================================================

function buildDailySheet(
  sheet: ExcelJS.Worksheet,
  students: any[],
  periods: any[],
  codes: any[],
  date: string,
  data: Map<string, string>
) {
  // Title row
  sheet.mergeCells(1, 1, 1, periods.length + 3)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `Attendance Sheet — ${new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })}`
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }

  // Header row
  const headerRow = sheet.getRow(3)
  headerRow.values = [
    '#',
    'Student Name',
    'ID',
    ...periods.map(p => p.period_name || `P${p.period_number}`)
  ]
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center' }

  // Set column widths
  sheet.getColumn(1).width = 5
  sheet.getColumn(2).width = 30
  sheet.getColumn(3).width = 12
  periods.forEach((_, i) => {
    sheet.getColumn(i + 4).width = 8
  })

  // Style header
  for (let col = 1; col <= periods.length + 3; col++) {
    const cell = headerRow.getCell(col)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  // Student rows
  students.forEach((student: any, idx) => {
    const row = sheet.getRow(idx + 4)
    const profile = student.profiles
    const fullName = `${profile?.last_name || ''}, ${profile?.first_name || ''}`.trim()

    row.values = [
      idx + 1,
      fullName,
      student.admission_number || '',
      ...periods.map(p => {
        const key = `${student.id}:${date}:${p.id}`
        return data.get(key) || ''
      })
    ]

    // Style data cells
    for (let col = 4; col <= periods.length + 3; col++) {
      const cell = row.getCell(col)
      cell.alignment = { horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }

      // Color-code based on value
      const val = cell.value as string
      if (val) {
        const code = codes.find(c => c.short_name === val)
        if (code) {
          const argb = 'FF' + (code.color || '#6B7280').replace('#', '')
          cell.font = { color: { argb }, bold: true }
        }
      }
    }

    // Zebra stripe
    if (idx % 2 === 1) {
      for (let col = 1; col <= periods.length + 3; col++) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        }
      }
    }
  })
}

function buildRangeSheet(
  sheet: ExcelJS.Worksheet,
  students: any[],
  periods: any[],
  codes: any[],
  dates: string[],
  data: Map<string, string>
) {
  // Title
  sheet.mergeCells(1, 1, 1, dates.length + 3)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `Attendance Sheet — ${dates[0]} to ${dates[dates.length - 1]}`
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }

  // For range view: show daily state (P/A/H) summarized across periods
  // Header
  const headerRow = sheet.getRow(3)
  headerRow.values = [
    '#',
    'Student Name',
    'ID',
    ...dates.map(d => {
      const dt = new Date(d)
      return `${dt.getMonth() + 1}/${dt.getDate()}`
    })
  ]
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center' }

  // Widths
  sheet.getColumn(1).width = 5
  sheet.getColumn(2).width = 30
  sheet.getColumn(3).width = 12
  dates.forEach((_, i) => {
    sheet.getColumn(i + 4).width = 7
  })

  // Style header
  for (let col = 1; col <= dates.length + 3; col++) {
    const cell = headerRow.getCell(col)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  // Student rows — show dominant code for each date
  students.forEach((student: any, idx) => {
    const row = sheet.getRow(idx + 4)
    const profile = student.profiles
    const fullName = `${profile?.last_name || ''}, ${profile?.first_name || ''}`.trim()

    row.values = [
      idx + 1,
      fullName,
      student.admission_number || '',
      ...dates.map(date => {
        // Get all period codes for this student+date, find the dominant one
        const periodCodes: string[] = []
        for (const p of periods) {
          const key = `${student.id}:${date}:${p.id}`
          const code = data.get(key)
          if (code) periodCodes.push(code)
        }
        if (periodCodes.length === 0) return ''
        // If all same, use that; otherwise show most common
        const counts = periodCodes.reduce((acc, c) => {
          acc[c] = (acc[c] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      })
    ]

    // Style
    for (let col = 4; col <= dates.length + 3; col++) {
      const cell = row.getCell(col)
      cell.alignment = { horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
      const val = cell.value as string
      if (val) {
        const code = codes.find(c => c.short_name === val)
        if (code) {
          const argb = 'FF' + (code.color || '#6B7280').replace('#', '')
          cell.font = { color: { argb }, bold: true }
        }
      }
    }

    if (idx % 2 === 1) {
      for (let col = 1; col <= dates.length + 3; col++) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        }
      }
    }
  })
}

function buildLegendSheet(sheet: ExcelJS.Worksheet, codes: any[]) {
  sheet.getColumn(1).width = 15
  sheet.getColumn(2).width = 25
  sheet.getColumn(3).width = 15
  sheet.getColumn(4).width = 15

  const titleRow = sheet.getRow(1)
  titleRow.values = ['Attendance Codes Legend']
  titleRow.font = { bold: true, size: 14 }

  const headerRow = sheet.getRow(3)
  headerRow.values = ['Code', 'Description', 'State Code', 'Effect']
  headerRow.font = { bold: true }

  codes.forEach((code, idx) => {
    const row = sheet.getRow(idx + 4)
    const effect = code.state_code === 'P' ? 'Counts as Present'
      : code.state_code === 'A' ? 'Counts as Absent'
      : 'Counts as Half Day'

    row.values = [code.short_name, code.title || code.short_name, code.state_code, effect]

    // Color the code cell
    if (code.color) {
      const argb = 'FF' + code.color.replace('#', '')
      row.getCell(1).font = { color: { argb }, bold: true, size: 12 }
    }
  })
}

/**
 * Generate a summary attendance report as Excel
 * Used for Attendance Summary export
 */
export const generateAttendanceSummarySheet = async (
  summaryData: any[],
  schoolName: string,
  dateRange: { start: string; end: string }
): Promise<{ buffer: Buffer; filename: string }> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Studently'

  const sheet = workbook.addWorksheet('Attendance Summary')

  // Title
  sheet.mergeCells(1, 1, 1, 10)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = `Attendance Summary — ${schoolName}`
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }

  sheet.mergeCells(2, 1, 2, 10)
  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = `${dateRange.start} to ${dateRange.end}`
  subtitleCell.font = { size: 11, italic: true }
  subtitleCell.alignment = { horizontal: 'center' }

  // Headers
  const headers = [
    '#', 'Student Name', 'ID', 'Grade', 'Section',
    'Days Present', 'Days Absent', 'Half Days', 'Total Days', 'Attendance %'
  ]
  const headerRow = sheet.getRow(4)
  headerRow.values = headers
  headerRow.font = { bold: true }

  // Widths
  const widths = [5, 30, 12, 15, 15, 14, 14, 12, 12, 14]
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w })

  // Style header
  for (let col = 1; col <= headers.length; col++) {
    const cell = headerRow.getCell(col)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  // Data rows
  summaryData.forEach((s, idx) => {
    const row = sheet.getRow(idx + 5)
    row.values = [
      idx + 1,
      s.student_name,
      s.student_number || '',
      s.grade_name || '',
      s.section_name || '',
      s.days_present,
      s.days_absent,
      s.days_half,
      s.total_days,
      `${s.attendance_percentage}%`
    ]

    // Color percentage
    const pctCell = row.getCell(10)
    const pct = s.attendance_percentage
    if (pct >= 90) {
      pctCell.font = { color: { argb: 'FF22C55E' }, bold: true }
    } else if (pct >= 75) {
      pctCell.font = { color: { argb: 'FFEAB308' }, bold: true }
    } else {
      pctCell.font = { color: { argb: 'FFEF4444' }, bold: true }
    }

    if (idx % 2 === 1) {
      for (let col = 1; col <= headers.length; col++) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        }
      }
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `Attendance_Summary_${dateRange.start}_to_${dateRange.end}.xlsx`

  return { buffer: Buffer.from(buffer), filename }
}

// ============================================================================
// COURSE-PERIOD-BASED ATTENDANCE SHEETS
// One worksheet per selected course period, with student roster
// Matches RosarioSIS PrintAttendanceSheets.php (template-clone approach)
// Uses cached header/style builder for efficiency instead of file template
// ============================================================================

interface CoursePeriodSheetInput {
  timetable_entry_id: string
  section_id: string
  period_id: string
  teacher_id: string | null
  label: string
}

/**
 * Generate a multi-sheet attendance workbook.
 * One sheet per selected course period, each with:
 *  - Header: Course Period title, Teacher name
 *  - Student roster: #, Name, ID, + blank attendance columns for each school day
 *
 * The "template" is built programmatically and reused via a helper — no stored
 * file needed. ExcelJS renders in-memory so cloning a file gives no speed gain
 * over building identical structures in code.
 */
export const generateCoursePeriodSheets = async (
  schoolId: string,
  coursePeriods: CoursePeriodSheetInput[],
  startDate: string,
  endDate: string,
  campusId?: string,
  includeInactive = false
): Promise<{ buffer: Buffer; filename: string }> => {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Studently'
  workbook.created = new Date()

  // Get school days in range
  let calQ = supabase
    .from('attendance_calendar')
    .select('school_date')
    .eq('school_id', schoolId)
    .eq('is_school_day', true)
    .gte('school_date', startDate)
    .lte('school_date', endDate)
    .order('school_date', { ascending: true })

  if (campusId) {
    calQ = calQ.or(`campus_id.eq.${campusId},campus_id.is.null`)
  }

  const { data: calDays } = await calQ
  const schoolDates = (calDays || []).map(c => c.school_date)

  // If no calendar data, fall back to weekdays
  const dates = schoolDates.length > 0 ? schoolDates : (() => {
    const ds: string[] = []
    const s = new Date(startDate)
    const e = new Date(endDate)
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getDay() !== 0 && d.getDay() !== 6) ds.push(d.toISOString().split('T')[0])
    }
    return ds
  })()

  // Get teacher names
  const teacherIds = [...new Set(coursePeriods.map(cp => cp.teacher_id).filter(Boolean))] as string[]
  const teacherMap = new Map<string, string>()
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabase
      .from('staff')
      .select('id, profiles!profile_id(first_name, last_name)')
      .in('id', teacherIds)
    for (const t of (teachers || []) as any[]) {
      teacherMap.set(t.id, `${t.profiles?.first_name || ''} ${t.profiles?.last_name || ''}`.trim())
    }
  }

  let hasStudents = false

  for (const cp of coursePeriods) {
    // Get students enrolled in this section
    let studentQ = supabase
      .from('students')
      .select(`
        id,
        admission_number,
        profiles!inner(first_name, last_name)
      `)
      .eq('school_id', schoolId)
      .eq('section_id', cp.section_id)

    if (!includeInactive) {
      studentQ = studentQ.eq('is_active', true)
    }

    const { data: students } = await studentQ

    if (!students || students.length === 0) continue
    hasStudents = true

    // Sanitize sheet name (max 31 chars, no special chars)
    const sheetName = cp.label
      .replace(/[\\/*?[\]:]/g, '')
      .substring(0, 31)

    const sheet = workbook.addWorksheet(sheetName)

    // Build the sheet using our cached template layout
    buildCoursePeriodSheet(
      sheet,
      cp.label,
      cp.teacher_id ? (teacherMap.get(cp.teacher_id) || '') : '',
      students,
      dates
    )
  }

  if (!hasStudents) {
    // Add an empty info sheet
    const sheet = workbook.addWorksheet('Info')
    sheet.getCell(1, 1).value = 'No students were found for the selected course periods.'
    sheet.getCell(1, 1).font = { size: 14, italic: true }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `Attendance_Sheets_${startDate}_to_${endDate}.xlsx`

  return { buffer: Buffer.from(buffer), filename }
}

/**
 * Cached template builder — creates consistent sheet layout.
 * This replaces the RosarioSIS approach of cloning a stored XLS template.
 * Same result, zero disk I/O, identical layout every time.
 */
function buildCoursePeriodSheet(
  sheet: ExcelJS.Worksheet,
  coursePeriodTitle: string,
  teacherName: string,
  students: any[],
  dates: string[]
) {
  const dateCount = dates.length
  const totalCols = 3 + dateCount // #, Name, ID, + dates

  // Row 1: Course Period title
  sheet.mergeCells(1, 1, 1, totalCols)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = coursePeriodTitle
  titleCell.font = { bold: true, size: 14 }
  titleCell.alignment = { horizontal: 'center' }

  // Row 2: Teacher name
  sheet.mergeCells(2, 1, 2, totalCols)
  const teacherCell = sheet.getCell(2, 1)
  teacherCell.value = `Teacher: ${teacherName || 'N/A'}`
  teacherCell.font = { size: 11, italic: true }
  teacherCell.alignment = { horizontal: 'center' }

  // Row 4: Header
  const headerRow = sheet.getRow(4)
  headerRow.values = [
    '#',
    'Student Name',
    'ID',
    ...dates.map(d => {
      const dt = new Date(d + 'T00:00:00')
      return `${dt.getMonth() + 1}/${dt.getDate()}`
    })
  ]
  headerRow.font = { bold: true }
  headerRow.alignment = { horizontal: 'center' }

  // Column widths
  sheet.getColumn(1).width = 5
  sheet.getColumn(2).width = 30
  sheet.getColumn(3).width = 12
  for (let i = 0; i < dateCount; i++) {
    sheet.getColumn(i + 4).width = 7
  }

  // Style header
  for (let col = 1; col <= totalCols; col++) {
    const cell = headerRow.getCell(col)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' }
    }
  }

  // Student rows — blank attendance cells for manual entry
  const sortedStudents = [...students].sort((a: any, b: any) => {
    const aName = `${a.profiles?.last_name || ''}, ${a.profiles?.first_name || ''}`
    const bName = `${b.profiles?.last_name || ''}, ${b.profiles?.first_name || ''}`
    return aName.localeCompare(bName)
  })

  sortedStudents.forEach((student: any, idx) => {
    const row = sheet.getRow(idx + 5)
    const profile = student.profiles
    const fullName = `${profile?.last_name || ''}, ${profile?.first_name || ''}`.trim()

    row.values = [
      idx + 1,
      fullName,
      student.admission_number || '',
      ...dates.map(() => '') // Empty cells for attendance marking
    ]

    // Style attendance cells with borders
    for (let col = 4; col <= totalCols; col++) {
      const cell = row.getCell(col)
      cell.alignment = { horizontal: 'center' }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      }
    }

    // Zebra stripe
    if (idx % 2 === 1) {
      for (let col = 1; col <= totalCols; col++) {
        row.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' }
        }
      }
    }
  })
}