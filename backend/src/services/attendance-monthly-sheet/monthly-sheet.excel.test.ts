import ExcelJS from 'exceljs'
import { renderMonthlySheetsExcel } from './monthly-sheet.excel'
import {
  buildMonthColumns,
  computeTotals,
  countWorkingDays,
  STATUS_LEGEND,
  type CellStatus,
  type MonthlySheetModel,
} from './sheet-model'

function makeModel(overrides: Partial<MonthlySheetModel> = {}, locale: 'en' | 'ar' = 'en'): MonthlySheetModel {
  const columns = buildMonthColumns(2026, 9, { locale, weekdays: [true, true, true, true, true, false, false] })
  const workingDays = countWorkingDays(columns)
  const cells: CellStatus[] = columns.map((c, i) => (c.isNonWorking ? '' : i % 5 === 0 ? 'A' : 'P'))
  return {
    header: {
      logoUrl: null,
      schoolName: 'Test School',
      address: 'Somewhere',
      title: 'Monthly Attendance Sheet',
      academicYear: '2026-2027',
      monthLabel: 'September 2026',
      groupLabel: 'Grade 5 / A',
      room: '102',
      supervisor: 'Ms Smith',
    },
    columns,
    workingDays,
    rows: [
      { id: 's1', number: '1001', name: 'Ali Ahmed', cells, totals: computeTotals(cells, workingDays) },
      { id: 's2', number: '1002', name: 'Sara Omar', cells: columns.map(() => '' as CellStatus), totals: computeTotals([], workingDays) },
    ],
    legend: STATUS_LEGEND,
    locale,
    mode: 'filled',
    ...overrides,
  }
}

async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as any)
  return wb
}

describe('renderMonthlySheetsExcel', () => {
  it('produces a sheet named after the group with a double header and frozen panes', async () => {
    const wb = await load(await renderMonthlySheetsExcel([makeModel()]))
    const ws = wb.getWorksheet('Grade 5 A')!
    expect(ws).toBeTruthy()
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 3, ySplit: 8 })
    // Row 7 = day names, row 8 = day numbers (Sep 1 2026 is a Tuesday)
    expect(ws.getCell(7, 4).value).toBe('Tue')
    expect(ws.getCell(8, 4).value).toBe('01')
    expect(ws.getCell(8, 33).value).toBe('30') // 30 days -> last day column is 3 + 30
  })

  it('shades non-working columns and locks them', async () => {
    const ws = (await load(await renderMonthlySheetsExcel([makeModel()]))).worksheets[0]
    const friday = 3 + 4 // 2026-09-04 is a Friday -> column index 3 + 4
    const cell = ws.getCell(9, friday)
    expect((cell.fill as any).fgColor.argb).toBe('FFE0E0E0')
    // Excel's default is "locked", which the file format stores as no attribute
    expect(cell.protection?.locked).not.toBe(false)
    expect(cell.dataValidation?.type).toBeUndefined()
    const tuesday = ws.getCell(9, 4)
    expect(tuesday.protection?.locked).toBe(false)
  })

  it('restricts working-day cells to the status codes with a dropdown', async () => {
    const ws = (await load(await renderMonthlySheetsExcel([makeModel()]))).worksheets[0]
    const dv = ws.getCell(9, 4).dataValidation
    expect(dv?.type).toBe('list')
    expect(dv?.formulae?.[0]).toBe('"P,A,EA,L,HD"')
  })

  it('injects native COUNTIF and rate formulas', async () => {
    const ws = (await load(await renderMonthlySheetsExcel([makeModel()]))).worksheets[0]
    const totalP = ws.getCell(9, 34).value as ExcelJS.CellFormulaValue
    expect(totalP.formula).toBe('COUNTIF(D9:AG9,"P")')
    const rate = ws.getCell(9, 39).value as ExcelJS.CellFormulaValue
    expect(rate.formula).toMatch(/^IFERROR\(AH9\/\$AM\$5,0\)$/)
    expect(ws.getCell(9, 39).numFmt).toBe('0.0%')
  })

  it('sets landscape, fit-to-one-page-wide, print area and repeated header rows', async () => {
    const ws = (await load(await renderMonthlySheetsExcel([makeModel()]))).worksheets[0]
    expect(ws.pageSetup.orientation).toBe('landscape')
    expect(ws.pageSetup.fitToWidth).toBe(1)
    expect(ws.pageSetup.fitToHeight).toBe(0)
    expect(ws.pageSetup.printArea).toBeTruthy()
    expect(ws.pageSetup.printTitlesRow).toBe('7:8')
  })

  it('writes the sign-off blocks and legend', async () => {
    const ws = (await load(await renderMonthlySheetsExcel([makeModel()]))).worksheets[0]
    const texts: string[] = []
    ws.eachRow((row) => row.eachCell((c) => { if (typeof c.value === 'string') texts.push(c.value) }))
    expect(texts.some((t) => t.startsWith('Prepared by'))).toBe(true)
    expect(texts.some((t) => t.startsWith('Approved by'))).toBe(true)
    expect(texts).toContain('EA — Excused Absence')
  })

  it('uses Arabic labels, RTL view and 31-day months', async () => {
    const columns = buildMonthColumns(2026, 10, { locale: 'ar' })
    const wb = await load(
      await renderMonthlySheetsExcel([
        makeModel({ columns, workingDays: countWorkingDays(columns), rows: [], locale: 'ar', mode: 'blank' }, 'ar'),
      ])
    )
    const ws = wb.worksheets[0]
    expect(ws.views[0].rightToLeft).toBe(true)
    expect(ws.getCell(7, 3).value).toBe('الاسم')
    expect(ws.getCell(8, 34).value).toBe('31')
  })

  it('creates one uniquely named sheet per model', async () => {
    const wb = await load(await renderMonthlySheetsExcel([makeModel(), makeModel()]))
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Grade 5 A', 'Grade 5 A 2'])
  })
})
