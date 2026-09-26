// Excel renderer for the monthly attendance sheet (ExcelJS). Produces a sheet
// that works both as a print-out and as a live workbook: dropdown-restricted
// status cells, native COUNTIF/rate formulas, frozen header + name columns,
// locked non-working days, landscape fit-to-width print setup.

import ExcelJS from 'exceljs'
import { STATUS_CODES, type CellStatus, type MonthlySheetModel, type StatusCode } from './sheet-model'

const LABELS = {
  en: {
    no: '#', id: 'ID', name: 'Name',
    present: 'Total Present', absent: 'Total Absent', excused: 'Total Excused', tardy: 'Total Tardy', half: 'Half-Days', rate: 'Attendance Rate',
    academicYear: 'Academic Year', month: 'Month', group: 'Class / Section / Dept.', room: 'Room', supervisor: 'Supervisor / Teacher', workingDays: 'Working days',
    legend: 'Legend', preparedBy: 'Prepared by: Teacher / Supervisor', preparedHint: 'Signature & Date',
    approvedBy: 'Approved by: School Principal / HR Manager', approvedHint: 'Signature & Stamp',
    invalidTitle: 'Invalid status', invalidMsg: 'Choose one of: P, A, EA, L, HD',
  },
  ar: {
    no: '#', id: 'الرقم', name: 'الاسم',
    present: 'إجمالي الحضور', absent: 'إجمالي الغياب', excused: 'غياب بعذر', tardy: 'إجمالي التأخير', half: 'خروج مبكر', rate: 'نسبة الحضور',
    academicYear: 'العام الدراسي', month: 'الشهر', group: 'الصف / الشعبة / القسم', room: 'القاعة', supervisor: 'المشرف / المعلم', workingDays: 'أيام الدوام',
    legend: 'المفتاح', preparedBy: 'أعدّه: المعلم / المشرف', preparedHint: 'التوقيع والتاريخ',
    approvedBy: 'اعتمده: مدير المدرسة / الموارد البشرية', approvedHint: 'التوقيع والختم',
    invalidTitle: 'حالة غير صالحة', invalidMsg: 'اختر: P, A, EA, L, HD',
  },
}

const CODE_COLORS: Record<StatusCode, string> = {
  P: 'C6EFCE',
  A: 'FFC7CE',
  EA: 'FFE0B2',
  L: 'FFF2CC',
  HD: 'DDEBF7',
}
const NON_WORKING = 'E0E0E0'
const HEADER_BG = 'D9E1F2'
const THIN = { style: 'thin' as const, color: { argb: 'FF808080' } }
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN }

const colLetter = (n: number): string => {
  let s = ''
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s
  return s
}

const fill = (rgb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${rgb}` } })

async function fetchLogo(url: string | null): Promise<{ buffer: Buffer; extension: 'png' | 'jpeg' } | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') || '').toLowerCase()
    const extension = type.includes('png') ? 'png' : type.includes('jpeg') || type.includes('jpg') ? 'jpeg' : null
    if (!extension) return null // svg/webp/gif aren't embeddable by ExcelJS
    return { buffer: Buffer.from(await res.arrayBuffer()), extension }
  } catch {
    return null
  }
}

function safeSheetName(raw: string, used: Set<string>): string {
  const base = (raw.replace(/[\\/*?:[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Sheet').slice(0, 28)
  let name = base
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 26)} ${i}`
  used.add(name.toLowerCase())
  return name
}

export async function renderMonthlySheetsExcel(models: MonthlySheetModel[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Studently'
  workbook.created = new Date()

  const usedNames = new Set<string>()
  for (const model of models) {
    await addSheet(workbook, model, safeSheetName(model.header.groupLabel, usedNames))
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

async function addSheet(workbook: ExcelJS.Workbook, model: MonthlySheetModel, sheetName: string): Promise<void> {
  const L = LABELS[model.locale]
  const isAr = model.locale === 'ar'
  const { columns, rows, header } = model

  const FIRST_DAY_COL = 4
  const lastDayCol = FIRST_DAY_COL + columns.length - 1
  const totalCols = [lastDayCol + 1, lastDayCol + 2, lastDayCol + 3, lastDayCol + 4, lastDayCol + 5, lastDayCol + 6]
  const lastCol = totalCols[5]
  const HEADER_ROW_1 = 7
  const HEADER_ROW_2 = 8
  const FIRST_DATA_ROW = 9
  const lastDataRow = FIRST_DATA_ROW + Math.max(rows.length, 1) - 1
  const workingDaysCell = `$${colLetter(lastCol)}$5`

  const ws = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: HEADER_ROW_2, rightToLeft: isAr }],
  })

  // Column widths
  ws.getColumn(1).width = 5
  ws.getColumn(2).width = 14
  ws.getColumn(3).width = 30
  for (let c = FIRST_DAY_COL; c <= lastDayCol; c++) ws.getColumn(c).width = 4.3
  totalCols.forEach((c) => { ws.getColumn(c).width = 9 })
  ws.getColumn(totalCols[5]).width = 11

  // ── Header block ───────────────────────────────────────────────────────
  const merge = (r: number, c1: number, c2: number, value: string, opts: Partial<ExcelJS.Style> & { height?: number } = {}) => {
    ws.mergeCells(r, c1, r, c2)
    const cell = ws.getCell(r, c1)
    cell.value = value
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    if (opts.font) cell.font = opts.font
    if (opts.height) ws.getRow(r).height = opts.height
    return cell
  }

  merge(1, 3, lastCol, header.schoolName, { font: { bold: true, size: 16 }, height: 24 })
  merge(2, 3, lastCol, header.address, { font: { size: 10, color: { argb: 'FF555555' } }, height: 15 })
  merge(3, 3, lastCol, header.title, { font: { bold: true, size: 14, color: { argb: 'FF8B0000' } }, height: 22 })
  const half = Math.floor((lastCol - 2) / 2) + 2
  merge(4, 3, half, `${L.academicYear}: ${header.academicYear}     ${L.month}: ${header.monthLabel}`, { font: { bold: true, size: 10 } })
  merge(4, half + 1, lastCol, `${L.group}: ${header.groupLabel}`, { font: { bold: true, size: 10 } })
  merge(5, 3, half, `${L.room}: ${header.room || '—'}     ${L.supervisor}: ${header.supervisor || '—'}`, { font: { size: 10 } })
  merge(5, half + 1, lastCol - 1, L.workingDays, { font: { size: 10 } })
  const wd = ws.getCell(5, lastCol)
  wd.value = model.workingDays
  wd.font = { bold: true, size: 10 }
  wd.alignment = { horizontal: 'center', vertical: 'middle' }

  const logo = await fetchLogo(header.logoUrl)
  if (logo) {
    const id = workbook.addImage({ buffer: logo.buffer as any, extension: logo.extension })
    ws.addImage(id, { tl: { col: 0.15, row: 0.15 }, ext: { width: 84, height: 70 } })
  }

  // ── Two-tier date header ──────────────────────────────────────────────
  const labelCell = (col: number, text: string) => {
    ws.mergeCells(HEADER_ROW_1, col, HEADER_ROW_2, col)
    const cell = ws.getCell(HEADER_ROW_1, col)
    cell.value = text
    cell.font = { bold: true, size: 9 }
    cell.fill = fill(HEADER_BG)
    cell.border = BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  }
  labelCell(1, L.no)
  labelCell(2, L.id)
  labelCell(3, L.name)
  const totalLabels = [L.present, L.absent, L.excused, L.tardy, L.half, L.rate]
  totalCols.forEach((c, i) => labelCell(c, totalLabels[i]))
  ws.getRow(HEADER_ROW_1).height = 26

  columns.forEach((col, i) => {
    const c = FIRST_DAY_COL + i
    const bg = col.isNonWorking ? NON_WORKING : HEADER_BG
    const top = ws.getCell(HEADER_ROW_1, c)
    top.value = col.dayName
    top.font = { bold: true, size: 8 }
    top.fill = fill(bg)
    top.border = BORDER
    top.alignment = { vertical: 'middle', horizontal: 'center', textRotation: isAr ? 0 : 90 }
    const bottom = ws.getCell(HEADER_ROW_2, c)
    bottom.value = String(col.day).padStart(2, '0')
    bottom.font = { bold: true, size: 9 }
    bottom.fill = fill(bg)
    bottom.border = BORDER
    bottom.alignment = { vertical: 'middle', horizontal: 'center' }
  })
  if (!isAr) ws.getRow(HEADER_ROW_1).height = 30

  // ── Body ──────────────────────────────────────────────────────────────
  const firstDay = colLetter(FIRST_DAY_COL)
  const lastDay = colLetter(lastDayCol)
  const colOf = (i: number) => colLetter(totalCols[i])

  const bodyRows = rows.length > 0 ? rows : []
  bodyRows.forEach((row, idx) => {
    const r = FIRST_DATA_ROW + idx
    const set = (c: number, v: ExcelJS.CellValue, align: 'left' | 'center' = 'center') => {
      const cell = ws.getCell(r, c)
      cell.value = v
      cell.border = BORDER
      cell.font = { size: 9 }
      cell.alignment = { vertical: 'middle', horizontal: align }
      return cell
    }
    set(1, idx + 1)
    set(2, row.number)
    set(3, row.name, isAr ? 'center' : 'left')

    columns.forEach((col, i) => {
      const cell = set(FIRST_DAY_COL + i, row.cells[i] || null)
      if (col.isNonWorking) {
        cell.fill = fill(NON_WORKING)
        cell.protection = { locked: true }
      } else {
        cell.protection = { locked: false }
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${STATUS_CODES.join(',')}"`],
          showErrorMessage: true,
          errorStyle: 'stop',
          errorTitle: L.invalidTitle,
          error: L.invalidMsg,
        }
      }
    })

    const range = `${firstDay}${r}:${lastDay}${r}`
    const countIf = (code: StatusCode, result: number) =>
      ({ formula: `COUNTIF(${range},"${code}")`, result }) as ExcelJS.CellFormulaValue
    set(totalCols[0], countIf('P', row.totals.totalPresent))
    set(totalCols[1], countIf('A', row.totals.totalAbsentUnexcused))
    set(totalCols[2], countIf('EA', row.totals.totalAbsentExcused))
    set(totalCols[3], countIf('L', row.totals.totalTardy))
    set(totalCols[4], countIf('HD', row.totals.totalHalfDay))
    const rate = set(totalCols[5], {
      formula: `IFERROR(${colOf(0)}${r}/${workingDaysCell},0)`,
      result: row.totals.attendanceRate / 100,
    } as ExcelJS.CellFormulaValue)
    rate.numFmt = '0.0%'
    ws.getRow(r).height = 16
  })

  // Empty roster: keep one blank bordered row so the grid is still visible
  if (bodyRows.length === 0) {
    for (let c = 1; c <= lastCol; c++) ws.getCell(FIRST_DATA_ROW, c).border = BORDER
  }

  // Colour each code
  ws.addConditionalFormatting({
    ref: `${firstDay}${FIRST_DATA_ROW}:${lastDay}${lastDataRow}`,
    rules: STATUS_CODES.map((code) => ({
      type: 'cellIs' as const,
      operator: 'equal' as const,
      formulae: [`"${code}"`],
      priority: 1,
      style: { fill: { type: 'pattern' as const, pattern: 'solid' as const, bgColor: { argb: `FF${CODE_COLORS[code]}` } } },
    })),
  })

  // ── Legend ────────────────────────────────────────────────────────────
  const legendRow = lastDataRow + 2
  const legendLabel = ws.getCell(legendRow, 1)
  ws.mergeCells(legendRow, 1, legendRow, 2)
  legendLabel.value = L.legend
  legendLabel.font = { bold: true, size: 9 }
  legendLabel.alignment = { vertical: 'middle', horizontal: 'center' }
  const span = Math.max(1, Math.floor((lastCol - 2) / model.legend.length))
  model.legend.forEach((item, i) => {
    const c1 = 3 + i * span
    const c2 = i === model.legend.length - 1 ? lastCol : c1 + span - 1
    ws.mergeCells(legendRow, c1, legendRow, c2)
    const cell = ws.getCell(legendRow, c1)
    cell.value = `${item.code} — ${isAr ? item.ar : item.en}`
    cell.font = { size: 9, bold: true }
    cell.fill = fill(CODE_COLORS[item.code])
    cell.border = BORDER
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  ws.getRow(legendRow).height = 20

  // ── Sign-off ──────────────────────────────────────────────────────────
  const signRow = legendRow + 2
  const mid = Math.floor(lastCol / 2)
  const signBlock = (c1: number, c2: number, title: string, hint: string) => {
    ws.mergeCells(signRow, c1, signRow, c2)
    const head = ws.getCell(signRow, c1)
    head.value = title
    head.font = { bold: true, size: 10 }
    head.alignment = { vertical: 'middle', horizontal: 'center' }
    head.fill = fill(HEADER_BG)
    ws.mergeCells(signRow + 1, c1, signRow + 2, c2)
    const body = ws.getCell(signRow + 1, c1)
    body.value = hint
    body.font = { size: 9, italic: true, color: { argb: 'FF777777' } }
    body.alignment = { vertical: 'bottom', horizontal: 'center' }
    for (let r = signRow; r <= signRow + 2; r++) for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = BORDER
  }
  signBlock(1, mid - 1, L.preparedBy, L.preparedHint)
  signBlock(mid + 1, lastCol, L.approvedBy, L.approvedHint)
  ws.getRow(signRow + 1).height = 24
  ws.getRow(signRow + 2).height = 24

  // ── Protection, print setup ───────────────────────────────────────────
  // Non-working day cells are locked; working cells stay editable. No password,
  // so the sheet can be unprotected from Review > Unprotect Sheet if needed.
  await ws.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    sort: false,
    autoFilter: false,
    insertRows: false,
    deleteRows: false,
  })

  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printArea: `A1:${colLetter(lastCol)}${signRow + 2}`,
    printTitlesRow: `${HEADER_ROW_1}:${HEADER_ROW_2}`,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  }
  ws.headerFooter.oddFooter = '&C&8Page &P of &N'
}

export type { CellStatus }
