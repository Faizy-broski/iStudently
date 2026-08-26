import ExcelJS from 'exceljs'
import crypto from 'crypto'
import { supabase } from '../config/supabase'
import { StudentService } from './student.service'
import { ParentService } from './parent.service'
import { bulkImportTeachers } from './teacher.service'
import { bulkImportStaff } from './staff.service'
import {
  createGradeLevel, getGradeLevels,
  createSection, getSections,
  createSubject
} from './academics.service'
import { feesService } from './fees.service'
import {
  ImportSheetName,
  IMPORT_SHEET_NAMES,
  IMPORT_PHASE_ORDER,
  ValidationReport,
  SheetValidationResult,
  ImportResultSummary,
  SheetResult,
  GeneratedCredential
} from '../types/school-data-import.types'

const studentService = new StudentService()
const parentService = new ParentService()

// ============================================================================
// Full School Data Import — orchestrator
//
// Migrates an entire school in from an outside system via one multi-tab
// workbook: Grades, Sections, Subjects, FeeCategories, FeeStructures,
// Teachers, Staff, Students, Parents, Invoices (historical bills), and
// Payments (historical payment record, paid invoices included).
//
// Runs as a background job (school_data_import_jobs), never inside a single
// HTTP request — app.ts enforces a hard 30s request timeout on every route,
// and a whole school's fee/payment history can be thousands of rows. This
// mirrors timetable-generation.service.ts's job pattern: create the job row
// synchronously and return its id, then process in the background, and if
// the process restarts mid-run the job is reconciled to 'failed' on startup
// (see reconcileOrphanedImportJobs below) rather than silently resumed —
// the same tradeoff the timetable generator already documents and makes.
//
// KNOWN LIMITATION (v1, matches the accepted validate→commit gap): the
// parsed workbook buffer is held in an in-process cache between /validate
// and /commit (keyed by a short-lived token), not persisted to Supabase
// Storage. That means a restart between those two calls (typically seconds
// to minutes apart, one admin session) loses the pending upload and the
// admin re-uploads — an acceptable v1 gap on this single-instance (cPanel)
// deployment. The v1.1 upgrade path is persisting the buffer to a private
// Storage bucket so /commit can survive a restart between the two calls too.
// ============================================================================

const VALIDATION_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const validationCache = new Map<string, { schoolId: string; buffer: Buffer; cachedAt: number }>()

function evictStaleValidationCacheEntries() {
  const cutoff = Date.now() - VALIDATION_CACHE_TTL_MS
  for (const [token, entry] of validationCache) {
    if (entry.cachedAt < cutoff) validationCache.delete(token)
  }
}

// ----------------------------------------------------------------------------
// Sheet column specs — single source of truth for the template workbook AND
// the validators below, so the two can never drift the way the audit found
// the existing per-entity CSV template endpoints already have.
// ----------------------------------------------------------------------------

interface ColumnSpec {
  key: string
  header: string
  required: boolean
  example: string
  note?: string
}

const SHEET_COLUMNS: Record<ImportSheetName, ColumnSpec[]> = {
  Grades: [
    { key: 'grade_name', header: 'grade_name', required: true, example: 'Grade 3' },
    { key: 'order_index', header: 'order_index', required: false, example: '3', note: 'Sort order; defaults to sheet row order' },
    { key: 'base_fee', header: 'base_fee', required: false, example: '0' }
  ],
  Sections: [
    { key: 'grade_name', header: 'grade_name', required: true, example: 'Grade 3', note: 'Must match a Grades sheet row' },
    { key: 'section_name', header: 'section_name', required: true, example: 'A' },
    { key: 'capacity', header: 'capacity', required: false, example: '40' }
  ],
  Subjects: [
    { key: 'grade_name', header: 'grade_name', required: true, example: 'Grade 3' },
    { key: 'subject_name', header: 'subject_name', required: true, example: 'Mathematics' },
    { key: 'code', header: 'code', required: true, example: 'MATH3' },
    { key: 'subject_type', header: 'subject_type', required: false, example: 'theory', note: 'theory | lab | practical (default theory)' }
  ],
  FeeCategories: [
    { key: 'category_name', header: 'category_name', required: true, example: 'Tuition' },
    { key: 'code', header: 'code', required: true, example: 'TUITION' },
    { key: 'description', header: 'description', required: false, example: '' },
    { key: 'is_mandatory', header: 'is_mandatory', required: false, example: 'Y' },
    { key: 'is_discountable', header: 'is_discountable', required: false, example: 'Y' },
    { key: 'display_order', header: 'display_order', required: false, example: '1' }
  ],
  FeeStructures: [
    { key: 'grade_name', header: 'grade_name', required: true, example: 'Grade 3' },
    { key: 'category_code', header: 'category_code', required: true, example: 'TUITION', note: 'Must match a FeeCategories sheet row' },
    { key: 'academic_year', header: 'academic_year', required: true, example: '2025-2026' },
    { key: 'period_type', header: 'period_type', required: true, example: 'monthly', note: 'monthly | termly | quarterly | semester | annual | one_time' },
    { key: 'period_name', header: 'period_name', required: false, example: '' },
    { key: 'period_number', header: 'period_number', required: false, example: '' },
    { key: 'amount', header: 'amount', required: true, example: '5000' },
    { key: 'due_date', header: 'due_date', required: false, example: '2025-09-05' }
  ],
  Teachers: [
    { key: 'external_id', header: 'external_id', required: false, example: 'T-1001', note: 'Old system\'s id for this teacher, optional but recommended' },
    { key: 'employee_number', header: 'employee_number', required: false, example: '' },
    { key: 'first_name', header: 'first_name', required: true, example: 'Amina' },
    { key: 'last_name', header: 'last_name', required: true, example: 'Khan' },
    { key: 'email', header: 'email', required: false, example: 'amina.khan@example.com' },
    { key: 'phone', header: 'phone', required: false, example: '' },
    { key: 'title', header: 'title', required: false, example: '' },
    { key: 'department', header: 'department', required: false, example: '' },
    { key: 'qualifications', header: 'qualifications', required: false, example: '' },
    { key: 'specialization', header: 'specialization', required: false, example: '' },
    { key: 'date_of_joining', header: 'date_of_joining', required: false, example: '2020-08-01' },
    { key: 'employment_type', header: 'employment_type', required: false, example: 'full_time', note: 'full_time | part_time | contract' },
    { key: 'payment_type', header: 'payment_type', required: false, example: 'fixed_salary', note: 'fixed_salary | hourly' },
    { key: 'base_salary', header: 'base_salary', required: false, example: '' }
  ],
  Staff: [
    { key: 'external_id', header: 'external_id', required: false, example: 'S-2001' },
    { key: 'role', header: 'role', required: false, example: 'staff', note: 'teacher | librarian | staff | admin | counselor' },
    { key: 'employee_number', header: 'employee_number', required: false, example: '' },
    { key: 'first_name', header: 'first_name', required: true, example: 'Bilal' },
    { key: 'last_name', header: 'last_name', required: true, example: 'Ahmed' },
    { key: 'email', header: 'email', required: false, example: '' },
    { key: 'phone', header: 'phone', required: false, example: '' },
    { key: 'title', header: 'title', required: false, example: '' },
    { key: 'department', header: 'department', required: false, example: '' },
    { key: 'employment_type', header: 'employment_type', required: false, example: 'full_time' },
    { key: 'payment_type', header: 'payment_type', required: false, example: 'fixed_salary' },
    { key: 'base_salary', header: 'base_salary', required: false, example: '' }
  ],
  Students: [
    { key: 'external_id', header: 'external_id', required: true, example: 'STU-3001', note: 'Old system\'s id — Parents/Invoices/Payments sheets reference students by this' },
    { key: 'student_number', header: 'student_number', required: false, example: '' },
    { key: 'first_name', header: 'first_name', required: true, example: 'Sara' },
    { key: 'father_name', header: 'father_name', required: false, example: '' },
    { key: 'grandfather_name', header: 'grandfather_name', required: false, example: '' },
    { key: 'last_name', header: 'last_name', required: true, example: 'Malik' },
    { key: 'email', header: 'email', required: false, example: '' },
    { key: 'phone', header: 'phone', required: false, example: '' },
    { key: 'gender', header: 'gender', required: false, example: 'female', note: 'male | female | other' },
    { key: 'date_of_birth', header: 'date_of_birth', required: false, example: '2015-04-12' },
    { key: 'national_id', header: 'national_id', required: false, example: '' },
    { key: 'grade_name', header: 'grade_name', required: true, example: 'Grade 3' },
    { key: 'section_name', header: 'section_name', required: false, example: 'A' },
    { key: 'admission_date', header: 'admission_date', required: false, example: '' }
  ],
  Parents: [
    { key: 'first_name', header: 'first_name', required: true, example: 'Fatima' },
    { key: 'last_name', header: 'last_name', required: true, example: 'Malik' },
    { key: 'email', header: 'email', required: false, example: '' },
    { key: 'phone', header: 'phone', required: false, example: '' },
    { key: 'relationship', header: 'relationship', required: true, example: 'mother', note: 'father | mother | guardian | other' },
    { key: 'is_emergency_contact', header: 'is_emergency_contact', required: false, example: 'Y' },
    { key: 'student_external_ids', header: 'student_external_ids', required: true, example: 'STU-3001', note: 'One or more Students.external_id, separated by ";" for multiple children' }
  ],
  Invoices: [
    { key: 'student_external_id', header: 'student_external_id', required: true, example: 'STU-3001' },
    { key: 'academic_year', header: 'academic_year', required: true, example: '2025-2026' },
    { key: 'fee_month', header: 'fee_month', required: true, example: '2025-09', note: 'Billing period label — "YYYY-MM" for monthly, or a term/semester name' },
    { key: 'category_code', header: 'category_code', required: true, example: 'TUITION' },
    { key: 'amount', header: 'amount', required: true, example: '5000' },
    { key: 'discount_amount', header: 'discount_amount', required: false, example: '0' },
    { key: 'due_date', header: 'due_date', required: false, example: '2025-09-05' }
  ],
  Payments: [
    { key: 'student_external_id', header: 'student_external_id', required: true, example: 'STU-3001' },
    { key: 'academic_year', header: 'academic_year', required: false, example: '2025-2026' },
    { key: 'fee_month', header: 'fee_month', required: false, example: '2025-09', note: 'Must match an Invoices row for this student; leave blank for a payment with no matching bill (e.g. an old lump-sum)' },
    { key: 'amount', header: 'amount', required: true, example: '5000' },
    { key: 'payment_date', header: 'payment_date', required: true, example: '2025-09-03' },
    { key: 'payment_method', header: 'payment_method', required: false, example: 'cash' },
    { key: 'payment_reference', header: 'payment_reference', required: false, example: '' },
    { key: 'receipt_number', header: 'receipt_number', required: false, example: '' },
    { key: 'notes', header: 'notes', required: false, example: '' }
  ]
}

// ----------------------------------------------------------------------------
// Template workbook generation
// ----------------------------------------------------------------------------

export async function generateTemplateWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Studently'

  for (const sheetName of IMPORT_SHEET_NAMES) {
    const cols = SHEET_COLUMNS[sheetName]
    const sheet = workbook.addWorksheet(sheetName)
    sheet.columns = cols.map((c) => ({ header: c.header, key: c.key, width: Math.max(16, c.header.length + 4) }))
    sheet.getRow(1).font = { bold: true }
    const exampleRow: Record<string, string> = {}
    for (const c of cols) exampleRow[c.key] = c.example
    sheet.addRow(exampleRow)
    sheet.getRow(2).font = { italic: true, color: { argb: 'FF888888' } }

    // Notes row (row 3), one cell per column carrying its note/required flag —
    // keeps documentation traveling with the file instead of a separate PDF
    // that can drift, and the school admin filling this in never has to leave
    // the sheet to know what's required.
    const notesRow: Record<string, string> = {}
    for (const c of cols) {
      const parts = [c.required ? 'REQUIRED' : 'optional']
      if (c.note) parts.push(c.note)
      notesRow[c.key] = parts.join(' — ')
    }
    sheet.addRow(notesRow)
    sheet.getRow(3).font = { italic: true, size: 9, color: { argb: 'FFAA6600' } }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

// ----------------------------------------------------------------------------
// Workbook parsing
// ----------------------------------------------------------------------------

type ParsedRow = Record<string, any> & { _row: number }
type ParsedWorkbook = Partial<Record<ImportSheetName, ParsedRow[]>>

async function parseWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const result: ParsedWorkbook = {}

  for (const sheetName of IMPORT_SHEET_NAMES) {
    const worksheet = workbook.getWorksheet(sheetName)
    if (!worksheet) continue

    const cols = SHEET_COLUMNS[sheetName]
    const headerRow = worksheet.getRow(1)
    const colIndexByKey = new Map<string, number>()
    headerRow.eachCell((cell, colNumber) => {
      const headerText = String(cell.value ?? '').trim()
      const spec = cols.find((c) => c.header.toLowerCase() === headerText.toLowerCase())
      if (spec) colIndexByKey.set(spec.key, colNumber)
    })

    const rows: ParsedRow[] = []
    // Row 1 = headers, row 2 = example, row 3 = notes — real data starts at 4.
    for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber++) {
      const excelRow = worksheet.getRow(rowNumber)
      if (excelRow.cellCount === 0) continue

      const row: ParsedRow = { _row: rowNumber }
      let hasAnyValue = false
      for (const c of cols) {
        const colIndex = colIndexByKey.get(c.key)
        const raw = colIndex ? excelRow.getCell(colIndex).value : undefined
        const value = normalizeCellValue(raw)
        if (value !== undefined && value !== '') hasAnyValue = true
        row[c.key] = value
      }
      if (hasAnyValue) rows.push(row)
    }

    result[sheetName] = rows
  }

  return result
}

function normalizeCellValue(raw: any): any {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'object' && raw instanceof Date) {
    return raw.toISOString().slice(0, 10)
  }
  if (typeof raw === 'object' && 'result' in raw) return normalizeCellValue(raw.result) // formula cell
  if (typeof raw === 'object' && 'text' in raw) return String(raw.text).trim() // rich text
  return typeof raw === 'string' ? raw.trim() : raw
}

function toBool(v: any, fallback = false): boolean {
  if (v === undefined || v === null || v === '') return fallback
  const s = String(v).trim().toLowerCase()
  return ['y', 'yes', 'true', '1'].includes(s)
}

function toNum(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function toDateOnly(v: any): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  const s = String(v).trim()
  // Already ISO date (from normalizeCellValue on a real Date cell) or plain text the sheet author typed.
  const d = new Date(s)
  if (isNaN(d.getTime())) return undefined
  return d.toISOString().slice(0, 10)
}

// ----------------------------------------------------------------------------
// Shared "resolution context" — built up sheet by sheet, in IMPORT_PHASE_ORDER,
// during both validation (dry run) and commit (real run), so later sheets can
// resolve the natural-key references (grade names, category codes, student
// external ids) earlier sheets introduced. This is the same natural-key ->
// UUID idMap technique school-settings-copy.service.ts's
// copyGradeLevelsAndSections already uses for cross-school grade/section
// reconciliation.
// ----------------------------------------------------------------------------

interface ImportContext {
  schoolId: string
  gradeIdByName: Map<string, string>       // lowercased grade_name -> id
  sectionIdByKey: Map<string, string>      // `${gradeId}|${lowercased section_name}` -> id
  feeCategoryIdByCode: Map<string, string> // lowercased code -> id
  feeCategoryNameByCode: Map<string, string>
  // grade_id|category_id|academic_year -> best-matching fee_structures row
  feeStructureByKey: Map<string, { id: string; due_date: string }>
  studentIdByExternalId: Map<string, string>
  studentGradeIdByExternalId: Map<string, string>
  studentFeeIdByGroupKey: Map<string, string> // `${studentExternalId}|${academic_year}|${fee_month}` -> student_fees.id
}

async function seedContext(schoolId: string): Promise<ImportContext> {
  const [grades, sections, categories] = await Promise.all([
    getGradeLevels(schoolId),
    getSections(schoolId),
    feesService.getFeeCategories(schoolId, false)
  ])

  const ctx: ImportContext = {
    schoolId,
    gradeIdByName: new Map(),
    sectionIdByKey: new Map(),
    feeCategoryIdByCode: new Map(),
    feeCategoryNameByCode: new Map(),
    feeStructureByKey: new Map(),
    studentIdByExternalId: new Map(),
    studentGradeIdByExternalId: new Map(),
    studentFeeIdByGroupKey: new Map()
  }

  for (const g of grades) ctx.gradeIdByName.set(g.name.trim().toLowerCase(), g.id)
  for (const s of sections as any[]) {
    // getSections(schoolId) (no gradeId) hits the get_all_sections_with_campus
    // RPC, whose row shape aliases the section's own name as `section` (not
    // `name` — that column holds the grade's name instead). See
    // fix_campus_academics_rls_complete.sql.
    const sectionName = s.section ?? s.name
    ctx.sectionIdByKey.set(`${s.grade_level_id}|${String(sectionName).trim().toLowerCase()}`, s.id)
  }
  for (const c of categories) {
    ctx.feeCategoryIdByCode.set(c.code.trim().toLowerCase(), c.id)
    ctx.feeCategoryNameByCode.set(c.code.trim().toLowerCase(), c.name)
  }

  return ctx
}

function invoiceGroupKey(studentExternalId: string, academicYear: string, feeMonth: string): string {
  return `${studentExternalId}|${academicYear}|${feeMonth}`
}

// ============================================================================
// VALIDATION (dry run — no DB writes)
// ============================================================================

export async function validateImport(schoolId: string, buffer: Buffer): Promise<{ token: string; report: ValidationReport }> {
  evictStaleValidationCacheEntries()

  const parsed = await parseWorkbook(buffer)
  const ctx = await seedContext(schoolId)
  const sheets: SheetValidationResult[] = []

  const sheetErrors: Partial<Record<ImportSheetName, { valid: ParsedRow[]; errors: { row: number; error: string }[] }>> = {}
  const pushResult = (sheet: ImportSheetName, valid: ParsedRow[], errors: { row: number; error: string }[]) => {
    sheetErrors[sheet] = { valid, errors }
    sheets.push({ sheet, valid_count: valid.length, invalid_count: errors.length, errors })
  }

  // ---- Grades ----
  {
    const rows = parsed.Grades || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const seenNames = new Set<string>()
    for (const row of rows) {
      const name = String(row.grade_name || '').trim()
      if (!name) { errors.push({ row: row._row, error: 'grade_name is required' }); continue }
      const key = name.toLowerCase()
      if (seenNames.has(key) || ctx.gradeIdByName.has(key)) {
        errors.push({ row: row._row, error: `Grade "${name}" already exists or is duplicated in this file` })
        continue
      }
      seenNames.add(key)
      valid.push(row)
    }
    pushResult('Grades', valid, errors)
  }

  // ---- Sections ---- (grade_name resolved against Grades sheet + existing DB grades)
  {
    const rows = parsed.Sections || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const gradeNamesInFile = new Set((sheetErrors.Grades?.valid || []).map((r) => String(r.grade_name).trim().toLowerCase()))
    const seenKeys = new Set<string>()
    for (const row of rows) {
      const gradeName = String(row.grade_name || '').trim()
      const sectionName = String(row.section_name || '').trim()
      if (!gradeName || !sectionName) { errors.push({ row: row._row, error: 'grade_name and section_name are required' }); continue }
      const gradeKey = gradeName.toLowerCase()
      if (!ctx.gradeIdByName.has(gradeKey) && !gradeNamesInFile.has(gradeKey)) {
        errors.push({ row: row._row, error: `No grade named "${gradeName}" found (checked existing grades and the Grades sheet)` })
        continue
      }
      const dedupeKey = `${gradeKey}|${sectionName.toLowerCase()}`
      if (seenKeys.has(dedupeKey)) { errors.push({ row: row._row, error: `Duplicate section "${sectionName}" for grade "${gradeName}" within this file` }); continue }
      seenKeys.add(dedupeKey)
      valid.push(row)
    }
    pushResult('Sections', valid, errors)
  }

  // ---- Subjects ----
  {
    const rows = parsed.Subjects || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const gradeNamesInFile = new Set((sheetErrors.Grades?.valid || []).map((r) => String(r.grade_name).trim().toLowerCase()))
    const seenCodes = new Set<string>()
    for (const row of rows) {
      const gradeName = String(row.grade_name || '').trim()
      const name = String(row.subject_name || '').trim()
      const code = String(row.code || '').trim()
      if (!gradeName || !name || !code) { errors.push({ row: row._row, error: 'grade_name, subject_name and code are required' }); continue }
      if (!ctx.gradeIdByName.has(gradeName.toLowerCase()) && !gradeNamesInFile.has(gradeName.toLowerCase())) {
        errors.push({ row: row._row, error: `No grade named "${gradeName}" found` }); continue
      }
      const type = String(row.subject_type || 'theory').trim().toLowerCase()
      if (!['theory', 'lab', 'practical'].includes(type)) {
        errors.push({ row: row._row, error: `Invalid subject_type "${type}" — must be theory, lab, or practical` }); continue
      }
      if (seenCodes.has(code.toLowerCase())) { errors.push({ row: row._row, error: `Duplicate subject code "${code}" within this file` }); continue }
      seenCodes.add(code.toLowerCase())
      valid.push(row)
    }
    pushResult('Subjects', valid, errors)
  }

  // ---- FeeCategories ----
  {
    const rows = parsed.FeeCategories || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const seenCodes = new Set<string>()
    for (const row of rows) {
      const name = String(row.category_name || '').trim()
      const code = String(row.code || '').trim()
      if (!name || !code) { errors.push({ row: row._row, error: 'category_name and code are required' }); continue }
      const codeKey = code.toLowerCase()
      if (ctx.feeCategoryIdByCode.has(codeKey) || seenCodes.has(codeKey)) {
        errors.push({ row: row._row, error: `Fee category code "${code}" already exists or is duplicated in this file` }); continue
      }
      seenCodes.add(codeKey)
      valid.push(row)
    }
    pushResult('FeeCategories', valid, errors)
  }

  // ---- FeeStructures ----
  const VALID_PERIOD_TYPES = ['monthly', 'termly', 'quarterly', 'semester', 'annual', 'one_time']
  {
    const rows = parsed.FeeStructures || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const gradeNamesInFile = new Set((sheetErrors.Grades?.valid || []).map((r) => String(r.grade_name).trim().toLowerCase()))
    const categoryCodesInFile = new Set((sheetErrors.FeeCategories?.valid || []).map((r) => String(r.code).trim().toLowerCase()))
    for (const row of rows) {
      const gradeName = String(row.grade_name || '').trim()
      const categoryCode = String(row.category_code || '').trim()
      const academicYear = String(row.academic_year || '').trim()
      const periodType = String(row.period_type || '').trim().toLowerCase()
      const amount = toNum(row.amount)
      if (!gradeName || !categoryCode || !academicYear || !periodType) {
        errors.push({ row: row._row, error: 'grade_name, category_code, academic_year and period_type are required' }); continue
      }
      if (!ctx.gradeIdByName.has(gradeName.toLowerCase()) && !gradeNamesInFile.has(gradeName.toLowerCase())) {
        errors.push({ row: row._row, error: `No grade named "${gradeName}" found` }); continue
      }
      if (!ctx.feeCategoryIdByCode.has(categoryCode.toLowerCase()) && !categoryCodesInFile.has(categoryCode.toLowerCase())) {
        errors.push({ row: row._row, error: `No fee category with code "${categoryCode}" found` }); continue
      }
      if (!VALID_PERIOD_TYPES.includes(periodType)) {
        errors.push({ row: row._row, error: `Invalid period_type "${periodType}"` }); continue
      }
      if (amount === undefined || amount < 0) {
        errors.push({ row: row._row, error: `Invalid amount "${row.amount}" — must be a non-negative number` }); continue
      }
      valid.push(row)
    }
    pushResult('FeeStructures', valid, errors)
  }

  // ---- Teachers ----
  {
    const rows = parsed.Teachers || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const seenEmails = new Set<string>()
    const seenExternalIds = new Set<string>()
    for (const row of rows) {
      if (!String(row.first_name || '').trim() || !String(row.last_name || '').trim()) {
        errors.push({ row: row._row, error: 'first_name and last_name are required' }); continue
      }
      const email = String(row.email || '').trim().toLowerCase()
      if (email && seenEmails.has(email)) { errors.push({ row: row._row, error: 'Duplicate email within this file' }); continue }
      if (email) seenEmails.add(email)
      const extId = String(row.external_id || '').trim()
      if (extId) {
        if (seenExternalIds.has(extId)) { errors.push({ row: row._row, error: `Duplicate external_id "${extId}" within this file` }); continue }
        seenExternalIds.add(extId)
      }
      valid.push(row)
    }
    pushResult('Teachers', valid, errors)
  }

  // ---- Staff ----
  {
    const rows = parsed.Staff || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const seenEmails = new Set<string>()
    const VALID_ROLES = ['teacher', 'librarian', 'staff', 'admin', 'counselor']
    for (const row of rows) {
      if (!String(row.first_name || '').trim() || !String(row.last_name || '').trim()) {
        errors.push({ row: row._row, error: 'first_name and last_name are required' }); continue
      }
      const role = String(row.role || '').trim().toLowerCase()
      if (role && !VALID_ROLES.includes(role)) { errors.push({ row: row._row, error: `Invalid role "${role}"` }); continue }
      const email = String(row.email || '').trim().toLowerCase()
      if (email && seenEmails.has(email)) { errors.push({ row: row._row, error: 'Duplicate email within this file' }); continue }
      if (email) seenEmails.add(email)
      valid.push(row)
    }
    pushResult('Staff', valid, errors)
  }

  // ---- Students ----
  {
    const rows = parsed.Students || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const gradeNamesInFile = new Set((sheetErrors.Grades?.valid || []).map((r) => String(r.grade_name).trim().toLowerCase()))
    const seenExternalIds = new Set<string>()
    for (const row of rows) {
      const extId = String(row.external_id || '').trim()
      if (!extId) { errors.push({ row: row._row, error: 'external_id is required (used to link Parents/Invoices/Payments to this student)' }); continue }
      if (seenExternalIds.has(extId)) { errors.push({ row: row._row, error: `Duplicate external_id "${extId}" within this file` }); continue }
      if (!String(row.first_name || '').trim() || !String(row.last_name || '').trim()) {
        errors.push({ row: row._row, error: 'first_name and last_name are required' }); continue
      }
      const gradeName = String(row.grade_name || '').trim()
      if (!gradeName) { errors.push({ row: row._row, error: 'grade_name is required' }); continue }
      if (!ctx.gradeIdByName.has(gradeName.toLowerCase()) && !gradeNamesInFile.has(gradeName.toLowerCase())) {
        errors.push({ row: row._row, error: `No grade named "${gradeName}" found` }); continue
      }
      const gender = String(row.gender || '').trim().toLowerCase()
      if (gender && !['male', 'female', 'other'].includes(gender)) {
        errors.push({ row: row._row, error: `Invalid gender "${gender}"` }); continue
      }
      seenExternalIds.add(extId)
      valid.push(row)
    }
    pushResult('Students', valid, errors)
  }

  const studentExternalIdsInFile = new Set((sheetErrors.Students?.valid || []).map((r) => String(r.external_id).trim()))

  // ---- Parents ----
  {
    const rows = parsed.Parents || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const VALID_RELATIONS = ['father', 'mother', 'guardian', 'other']
    for (const row of rows) {
      if (!String(row.first_name || '').trim() || !String(row.last_name || '').trim()) {
        errors.push({ row: row._row, error: 'first_name and last_name are required' }); continue
      }
      const relation = String(row.relationship || '').trim().toLowerCase()
      if (!VALID_RELATIONS.includes(relation)) {
        errors.push({ row: row._row, error: `Invalid relationship "${relation}" — must be father, mother, guardian, or other` }); continue
      }
      const ids = String(row.student_external_ids || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean)
      if (ids.length === 0) { errors.push({ row: row._row, error: 'student_external_ids is required' }); continue }
      const unknown = ids.filter((id) => !studentExternalIdsInFile.has(id))
      if (unknown.length > 0) {
        errors.push({ row: row._row, error: `Unknown student external_id(s): ${unknown.join(', ')} (not found in the Students sheet)` }); continue
      }
      valid.push(row)
    }
    pushResult('Parents', valid, errors)
  }

  // ---- Invoices ---- (grouped later at commit time; validate each line here)
  {
    const rows = parsed.Invoices || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const categoryCodesInFile = new Set((sheetErrors.FeeCategories?.valid || []).map((r) => String(r.code).trim().toLowerCase()))
    for (const row of rows) {
      const studentExtId = String(row.student_external_id || '').trim()
      const academicYear = String(row.academic_year || '').trim()
      const feeMonth = String(row.fee_month || '').trim()
      const categoryCode = String(row.category_code || '').trim()
      const amount = toNum(row.amount)
      if (!studentExtId || !academicYear || !feeMonth || !categoryCode) {
        errors.push({ row: row._row, error: 'student_external_id, academic_year, fee_month and category_code are required' }); continue
      }
      if (!studentExternalIdsInFile.has(studentExtId)) {
        errors.push({ row: row._row, error: `Unknown student external_id "${studentExtId}" (not found in the Students sheet)` }); continue
      }
      if (!ctx.feeCategoryIdByCode.has(categoryCode.toLowerCase()) && !categoryCodesInFile.has(categoryCode.toLowerCase())) {
        errors.push({ row: row._row, error: `No fee category with code "${categoryCode}" found` }); continue
      }
      if (amount === undefined || amount < 0) {
        errors.push({ row: row._row, error: `Invalid amount "${row.amount}" — must be a non-negative number` }); continue
      }
      const discount = toNum(row.discount_amount) ?? 0
      if (discount < 0 || discount > amount) {
        errors.push({ row: row._row, error: `Invalid discount_amount "${row.discount_amount}" — must be between 0 and amount` }); continue
      }
      valid.push(row)
    }
    pushResult('Invoices', valid, errors)
  }

  // ---- Payments ----
  {
    const rows = parsed.Payments || []
    const valid: ParsedRow[] = []
    const errors: { row: number; error: string }[] = []
    const invoiceGroupKeysInFile = new Set(
      (sheetErrors.Invoices?.valid || []).map((r) => invoiceGroupKey(String(r.student_external_id).trim(), String(r.academic_year).trim(), String(r.fee_month).trim()))
    )
    const seenReceipts = new Set<string>()
    const today = new Date().toISOString().slice(0, 10)
    for (const row of rows) {
      const studentExtId = String(row.student_external_id || '').trim()
      const amount = toNum(row.amount)
      const paymentDate = toDateOnly(row.payment_date)
      if (!studentExtId || amount === undefined || !paymentDate) {
        errors.push({ row: row._row, error: 'student_external_id, amount and a valid payment_date are required' }); continue
      }
      if (!studentExternalIdsInFile.has(studentExtId)) {
        errors.push({ row: row._row, error: `Unknown student external_id "${studentExtId}" (not found in the Students sheet)` }); continue
      }
      if (amount < 0) { errors.push({ row: row._row, error: `Invalid amount "${row.amount}" — must be non-negative` }); continue }
      if (paymentDate > today) { errors.push({ row: row._row, error: `payment_date "${paymentDate}" is in the future` }); continue }
      const feeMonth = String(row.fee_month || '').trim()
      const academicYear = String(row.academic_year || '').trim()
      if (feeMonth) {
        if (!academicYear) { errors.push({ row: row._row, error: 'academic_year is required when fee_month is given' }); continue }
        const key = invoiceGroupKey(studentExtId, academicYear, feeMonth)
        if (!invoiceGroupKeysInFile.has(key)) {
          errors.push({ row: row._row, error: `No matching Invoices row for student "${studentExtId}", ${academicYear} / ${feeMonth} — leave fee_month blank for a payment with no matching bill` }); continue
        }
      }
      const receipt = String(row.receipt_number || '').trim()
      if (receipt) {
        if (seenReceipts.has(receipt)) { errors.push({ row: row._row, error: `Duplicate receipt_number "${receipt}" within this file` }); continue }
        seenReceipts.add(receipt)
      }
      valid.push(row)
    }
    pushResult('Payments', valid, errors)
  }

  const total_valid = sheets.reduce((s, r) => s + r.valid_count, 0)
  const total_invalid = sheets.reduce((s, r) => s + r.invalid_count, 0)
  const report: ValidationReport = { sheets, total_valid, total_invalid, ok_to_commit: total_invalid === 0 && total_valid > 0 }

  const token = crypto.randomUUID()
  validationCache.set(token, { schoolId, buffer, cachedAt: Date.now() })

  return { token, report }
}

// ============================================================================
// COMMIT (background job)
// ============================================================================

export class ImportTokenExpiredError extends Error {
  constructor() {
    super('The validated upload is no longer available — please re-upload and validate the workbook again.')
    this.name = 'ImportTokenExpiredError'
  }
}

export async function startImportJob(params: {
  schoolId: string
  token: string
  originalFilename?: string
  createdBy?: string
}): Promise<{ jobId: string }> {
  const cached = validationCache.get(params.token)
  if (!cached || cached.schoolId !== params.schoolId) throw new ImportTokenExpiredError()

  // One active job per school at a time — same guard timetable-generation
  // service uses for overlapping runs.
  const { data: activeJobs, error: activeErr } = await supabase
    .from('school_data_import_jobs')
    .select('id')
    .eq('school_id', params.schoolId)
    .in('status', ['queued', 'validating', 'running'])
  if (activeErr) throw activeErr
  if (activeJobs && activeJobs.length > 0) {
    throw new Error(`An import is already in progress for this school (job ${activeJobs[0].id}) — wait for it to finish before starting another.`)
  }

  const { data: job, error: insertErr } = await supabase
    .from('school_data_import_jobs')
    .insert({
      school_id: params.schoolId,
      status: 'queued',
      original_filename: params.originalFilename || null,
      created_by: params.createdBy || null
    })
    .select('id')
    .single()
  if (insertErr) throw insertErr

  const jobId = job.id as string
  validationCache.delete(params.token)

  runImport(jobId, params.schoolId, cached.buffer).catch(async (err: any) => {
    console.error(`[school-data-import] job ${jobId} crashed outside runImport's own guard:`, err)
    try {
      await supabase.from('school_data_import_jobs').update({
        status: 'failed',
        error_message: safeErrorMessage(err),
        finished_at: new Date().toISOString()
      }).eq('id', jobId)
    } catch (persistErr) {
      console.error(`[school-data-import] job ${jobId} failed AND failed to persist failure status:`, persistErr)
    }
  })

  return { jobId }
}

function safeErrorMessage(err: any): string {
  const msg = err?.message || String(err)
  return msg.length > 1000 ? msg.slice(0, 1000) + '…' : msg
}

async function updateJob(jobId: string, patch: Record<string, any>) {
  await supabase.from('school_data_import_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', jobId)
}

export async function runImport(jobId: string, schoolId: string, buffer: Buffer): Promise<void> {
  await updateJob(jobId, { status: 'running', started_at: new Date().toISOString(), progress_percent: 0 })

  const parsed = await parseWorkbook(buffer)
  const ctx = await seedContext(schoolId)

  const sheets: SheetResult[] = []
  const credentials: GeneratedCredential[] = []
  const totalPhases = IMPORT_PHASE_ORDER.length
  let phaseIndex = 0

  const nextPhase = async (phase: ImportSheetName) => {
    phaseIndex++
    await updateJob(jobId, { current_phase: phase, progress_percent: Math.round((phaseIndex / totalPhases) * 100) })
  }

  try {
    // ---- Grades ----
    await nextPhase('Grades')
    {
      const rows = parsed.Grades || []
      const result: SheetResult = { sheet: 'Grades', created: 0, skipped: 0, failed: 0, errors: [] }
      let i = 0
      for (const row of rows) {
        i++
        const name = String(row.grade_name || '').trim()
        if (!name || ctx.gradeIdByName.has(name.toLowerCase())) { result.skipped++; continue }
        try {
          const grade = await createGradeLevel({
            school_id: schoolId,
            name,
            order_index: toNum(row.order_index) ?? i,
            base_fee: toNum(row.base_fee) ?? 0
          })
          // createGradeLevel's insert lists its own columns explicitly and has
          // no import_job_id parameter, so it's tagged with a follow-up update
          // rather than threaded through the DTO.
          await tagRowWithJob('grade_levels', grade.id, jobId)
          ctx.gradeIdByName.set(name.toLowerCase(), grade.id)
          result.created++
        } catch (err: any) {
          result.failed++
          result.errors.push({ row: row._row, error: err.message || String(err) })
        }
      }
      sheets.push(result)
    }

    // ---- Sections ----
    await nextPhase('Sections')
    {
      const rows = parsed.Sections || []
      const result: SheetResult = { sheet: 'Sections', created: 0, skipped: 0, failed: 0, errors: [] }
      for (const row of rows) {
        const gradeId = ctx.gradeIdByName.get(String(row.grade_name || '').trim().toLowerCase())
        const sectionName = String(row.section_name || '').trim()
        if (!gradeId || !sectionName) { result.skipped++; continue }
        const dedupeKey = `${gradeId}|${sectionName.toLowerCase()}`
        if (ctx.sectionIdByKey.has(dedupeKey)) { result.skipped++; continue }
        try {
          const section = await createSection({
            school_id: schoolId,
            grade_level_id: gradeId,
            name: sectionName,
            capacity: toNum(row.capacity) ?? 40
          })
          await tagRowWithJob('sections', section.id, jobId)
          ctx.sectionIdByKey.set(dedupeKey, section.id)
          result.created++
        } catch (err: any) {
          result.failed++
          result.errors.push({ row: row._row, error: err.message || String(err) })
        }
      }
      sheets.push(result)
    }

    // ---- Subjects ----
    await nextPhase('Subjects')
    {
      const rows = parsed.Subjects || []
      const result: SheetResult = { sheet: 'Subjects', created: 0, skipped: 0, failed: 0, errors: [] }
      for (const row of rows) {
        const gradeId = ctx.gradeIdByName.get(String(row.grade_name || '').trim().toLowerCase())
        const name = String(row.subject_name || '').trim()
        const code = String(row.code || '').trim()
        if (!gradeId || !name || !code) { result.skipped++; continue }
        try {
          const subject = await createSubject({
            school_id: schoolId,
            grade_level_id: gradeId,
            name,
            code,
            subject_type: (String(row.subject_type || 'theory').trim().toLowerCase() as any)
          })
          await tagRowWithJob('subjects', subject.id, jobId)
          result.created++
        } catch (err: any) {
          result.failed++
          result.errors.push({ row: row._row, error: err.message || String(err) })
        }
      }
      sheets.push(result)
    }

    // ---- FeeCategories ----
    await nextPhase('FeeCategories')
    {
      const rows = parsed.FeeCategories || []
      const result: SheetResult = { sheet: 'FeeCategories', created: 0, skipped: 0, failed: 0, errors: [] }
      for (const row of rows) {
        const name = String(row.category_name || '').trim()
        const code = String(row.code || '').trim()
        if (!name || !code || ctx.feeCategoryIdByCode.has(code.toLowerCase())) { result.skipped++; continue }
        try {
          const category = await feesService.createFeeCategory({
            school_id: schoolId,
            name,
            code,
            description: row.description ? String(row.description).trim() : undefined,
            is_mandatory: toBool(row.is_mandatory, true),
            is_discountable: toBool(row.is_discountable, true),
            display_order: toNum(row.display_order) ?? 0
          })
          await tagRowWithJob('fee_categories', category.id, jobId)
          ctx.feeCategoryIdByCode.set(code.toLowerCase(), category.id)
          ctx.feeCategoryNameByCode.set(code.toLowerCase(), name)
          result.created++
        } catch (err: any) {
          result.failed++
          result.errors.push({ row: row._row, error: err.message || String(err) })
        }
      }
      sheets.push(result)
    }

    // ---- FeeStructures ----
    await nextPhase('FeeStructures')
    {
      const rows = parsed.FeeStructures || []
      const result: SheetResult = { sheet: 'FeeStructures', created: 0, skipped: 0, failed: 0, errors: [] }
      for (const row of rows) {
        const gradeId = ctx.gradeIdByName.get(String(row.grade_name || '').trim().toLowerCase())
        const categoryId = ctx.feeCategoryIdByCode.get(String(row.category_code || '').trim().toLowerCase())
        const academicYear = String(row.academic_year || '').trim()
        const periodType = String(row.period_type || '').trim().toLowerCase()
        const amount = toNum(row.amount)
        if (!gradeId || !categoryId || !academicYear || !periodType || amount === undefined) { result.skipped++; continue }
        const dueDate = toDateOnly(row.due_date) || defaultDueDate(academicYear)
        try {
          const structure = await feesService.createFeeStructure({
            school_id: schoolId,
            grade_level_id: gradeId,
            fee_category_id: categoryId,
            academic_year: academicYear,
            period_type: periodType,
            period_name: row.period_name ? String(row.period_name).trim() : null,
            period_number: toNum(row.period_number) ?? null,
            amount,
            due_date: dueDate,
            import_job_id: jobId
          })
          ctx.feeStructureByKey.set(`${gradeId}|${categoryId}|${academicYear}`, { id: structure.id, due_date: dueDate })
          result.created++
        } catch (err: any) {
          result.failed++
          result.errors.push({ row: row._row, error: err.message || String(err) })
        }
      }
      sheets.push(result)
    }

    // ---- Teachers ---- (reuses the existing bulk importer wholesale)
    await nextPhase('Teachers')
    {
      const rows = (parsed.Teachers || []).map((r) => ({ ...r }))
      if (rows.length > 0) {
        const teacherResult = await bulkImportTeachers(rows, schoolId)
        sheets.push({
          sheet: 'Teachers',
          created: teacherResult.success_count,
          skipped: 0,
          failed: teacherResult.error_count,
          errors: teacherResult.errors.map((e) => ({ row: e.row, error: e.error }))
        })
        for (const c of teacherResult.created) {
          if (c.username) {
            const row = rows.find((r) => r._row === c.row)
            credentials.push({ entity: 'teacher', row: c.row, name: `${row?.first_name || ''} ${row?.last_name || ''}`.trim(), username: c.username, password: c.password })
          }
          if (c.id) await tagRowWithJob('staff', c.id, jobId)
        }
      } else {
        sheets.push({ sheet: 'Teachers', created: 0, skipped: 0, failed: 0, errors: [] })
      }
    }

    // ---- Staff ---- (reuses the existing bulk importer wholesale)
    await nextPhase('Staff')
    {
      const rows = (parsed.Staff || []).map((r) => ({ ...r }))
      if (rows.length > 0) {
        // bulkImportStaff writes creatorId straight into staff.created_by as a
        // UUID literal — an empty-string fallback would fail every row with a
        // Postgres "invalid input syntax for type uuid" error instead of
        // failing clearly, so this is a hard precondition rather than a soft
        // fallback. In practice createdBy is always the authenticated admin
        // who started the job (see the controller), so this should never fire.
        const creatorId = await getJobCreatedBy(jobId)
        if (!creatorId) throw new Error('Cannot import Staff rows: the import job has no created_by profile recorded')
        const staffResult = await bulkImportStaff(rows, schoolId, creatorId)
        sheets.push({
          sheet: 'Staff',
          created: staffResult.success_count,
          skipped: 0,
          failed: staffResult.error_count,
          errors: staffResult.errors.map((e) => ({ row: e.row, error: e.error }))
        })
        for (const c of staffResult.created) {
          if (c.username) {
            const row = rows.find((r) => r._row === c.row)
            credentials.push({ entity: 'staff', row: c.row, name: `${row?.first_name || ''} ${row?.last_name || ''}`.trim(), username: c.username, password: c.password })
          }
          if (c.id) await tagRowWithJob('staff', c.id, jobId)
        }
      } else {
        sheets.push({ sheet: 'Staff', created: 0, skipped: 0, failed: 0, errors: [] })
      }
    }

    // ---- Students ---- (reuses the existing bulk importer wholesale)
    await nextPhase('Students')
    {
      const rows = parsed.Students || []
      const result: SheetResult = { sheet: 'Students', created: 0, skipped: 0, failed: 0, errors: [] }
      // bulkImportStudents processes one at a time and doesn't accept
      // per-row grade/section, so each row is resolved and submitted
      // individually here (still reusing createStudent underneath via a
      // single-row array — keeps the exact same dedupe/credential logic).
      for (const row of rows) {
        const gradeId = ctx.gradeIdByName.get(String(row.grade_name || '').trim().toLowerCase())
        const sectionId = row.section_name
          ? ctx.sectionIdByKey.get(`${gradeId}|${String(row.section_name).trim().toLowerCase()}`)
          : undefined
        const extId = String(row.external_id || '').trim()
        if (!gradeId || !extId) { result.skipped++; continue }
        const importResult = await studentService.bulkImportStudents(
          [{
            _row: row._row,
            first_name: row.first_name,
            father_name: row.father_name,
            grandfather_name: row.grandfather_name,
            last_name: row.last_name,
            email: row.email || undefined,
            phone: row.phone || undefined,
            gender: row.gender || undefined,
            date_of_birth: toDateOnly(row.date_of_birth),
            national_id: row.national_id || undefined,
            student_number: row.student_number || undefined,
            grade_level_id: gradeId,
            section_id: sectionId,
            custom_fields: { _import_external_id: extId, _import_job_id: jobId }
          }],
          schoolId
        )
        if (importResult.success_count > 0) {
          result.created++
          const createdStudentId = await findStudentIdByExternalId(schoolId, extId)
          if (createdStudentId) {
            ctx.studentIdByExternalId.set(extId, createdStudentId)
            ctx.studentGradeIdByExternalId.set(extId, gradeId)
            await tagRowWithJob('students', createdStudentId, jobId)
          }
          const created = importResult.created[0] as any
          if (created?.username) {
            credentials.push({ entity: 'student', row: row._row, name: `${row.first_name} ${row.last_name}`.trim(), username: created.username, password: created.password })
          }
        } else {
          result.failed++
          result.errors.push({ row: row._row, error: importResult.errors[0]?.error || 'Failed to create student' })
        }
      }
      sheets.push(result)
    }

    // ---- Parents ----
    await nextPhase('Parents')
    {
      const rows = parsed.Parents || []
      const parentRows = rows.map((row) => {
        const ids = String(row.student_external_ids || '').split(/[;,]/).map((s) => s.trim()).filter(Boolean)
        const studentIds = ids.map((id) => ctx.studentIdByExternalId.get(id)).filter((v): v is string => !!v)
        return {
          _row: row._row,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email || undefined,
          phone: row.phone || undefined,
          relationship: String(row.relationship || '').trim().toLowerCase(),
          relation_type: String(row.relationship || '').trim().toLowerCase() as any,
          is_emergency_contact: toBool(row.is_emergency_contact, false),
          student_ids: studentIds
        }
      })
      const parentResult = await parentService.bulkImportParents(parentRows, schoolId)
      sheets.push({
        sheet: 'Parents',
        created: parentResult.success_count,
        skipped: 0,
        failed: parentResult.error_count,
        errors: parentResult.errors
      })
      for (const c of parentResult.created) {
        if (c.username) {
          const row = rows.find((r) => r._row === c.row)
          credentials.push({ entity: 'parent', row: c.row, name: `${row?.first_name || ''} ${row?.last_name || ''}`.trim(), username: c.username, password: c.password })
        }
        await tagRowWithJob('parents', c.id, jobId)
      }
    }

    // ---- Invoices ---- (grouped into one student_fees row per student/period)
    await nextPhase('Invoices')
    {
      const rows = parsed.Invoices || []
      const groups = new Map<string, ParsedRow[]>()
      for (const row of rows) {
        const key = invoiceGroupKey(String(row.student_external_id).trim(), String(row.academic_year).trim(), String(row.fee_month).trim())
        const list = groups.get(key) || []
        list.push(row)
        groups.set(key, list)
      }

      const result: SheetResult = { sheet: 'Invoices', created: 0, skipped: 0, failed: 0, errors: [] }
      for (const [key, lines] of groups) {
        const first = lines[0]
        const studentExtId = String(first.student_external_id).trim()
        const studentId = ctx.studentIdByExternalId.get(studentExtId)
        const gradeId = ctx.studentGradeIdByExternalId.get(studentExtId)
        if (!studentId || !gradeId) { result.skipped += lines.length; continue }

        const academicYear = String(first.academic_year).trim()
        const feeMonth = String(first.fee_month).trim()

        try {
          let baseAmount = 0
          let discountTotal = 0
          let earliestDue: string | undefined
          let primaryStructureId: string | undefined
          const breakdown: any[] = []

          for (const line of lines) {
            const categoryCode = String(line.category_code).trim().toLowerCase()
            const categoryId = ctx.feeCategoryIdByCode.get(categoryCode)
            if (!categoryId) throw new Error(`Fee category "${line.category_code}" not found`)
            const amount = toNum(line.amount) ?? 0
            const discount = toNum(line.discount_amount) ?? 0
            baseAmount += amount
            discountTotal += discount
            breakdown.push({
              category_id: categoryId,
              category_name: ctx.feeCategoryNameByCode.get(categoryCode) || line.category_code,
              category_code: line.category_code,
              amount: amount - discount
            })
            const lineDue = toDateOnly(line.due_date)
            if (lineDue && (!earliestDue || lineDue < earliestDue)) earliestDue = lineDue
            const structure = ctx.feeStructureByKey.get(`${gradeId}|${categoryId}|${academicYear}`)
            if (structure && !primaryStructureId) {
              primaryStructureId = structure.id
              if (!earliestDue) earliestDue = structure.due_date
            }
          }

          if (!primaryStructureId) {
            throw new Error(`No matching fee structure found for grade/category/academic_year — add a FeeStructures row for this combination`)
          }

          const finalAmount = round2(baseAmount - discountTotal)
          const { data: studentFee, error } = await supabase
            .from('student_fees')
            .insert({
              school_id: schoolId,
              student_id: studentId,
              fee_structure_id: primaryStructureId,
              academic_year: academicYear,
              fee_month: feeMonth,
              base_amount: round2(baseAmount),
              custom_discount: round2(discountTotal),
              final_amount: finalAmount,
              amount_paid: 0,
              status: 'pending',
              due_date: earliestDue || defaultDueDate(academicYear),
              fee_breakdown: breakdown,
              import_job_id: jobId
            })
            .select('id')
            .single()

          if (error) throw new Error(error.message)
          ctx.studentFeeIdByGroupKey.set(key, studentFee.id)
          result.created++
        } catch (err: any) {
          result.failed += lines.length
          result.errors.push({ row: first._row, error: err.message || String(err) })
        }
      }
      sheets.push(result)
    }

    // ---- Payments ----
    await nextPhase('Payments')
    {
      const rows = parsed.Payments || []
      const result: SheetResult = { sheet: 'Payments', created: 0, skipped: 0, failed: 0, errors: [] }
      const touchedStudentFeeIds = new Set<string>()

      for (const row of rows) {
        const studentExtId = String(row.student_external_id || '').trim()
        const studentId = ctx.studentIdByExternalId.get(studentExtId)
        const amount = toNum(row.amount)
        const paymentDate = toDateOnly(row.payment_date)
        if (!studentId || amount === undefined || !paymentDate) { result.skipped++; continue }

        try {
          const feeMonth = String(row.fee_month || '').trim()
          const academicYear = String(row.academic_year || '').trim()
          let studentFeeId: string | undefined

          if (feeMonth && academicYear) {
            studentFeeId = ctx.studentFeeIdByGroupKey.get(invoiceGroupKey(studentExtId, academicYear, feeMonth))
            if (!studentFeeId) throw new Error(`No matching invoice found for ${academicYear} / ${feeMonth}`)
          } else {
            // No matching bill (e.g. an old lump-sum payment) — mirrors
            // feesService.recordDirectPayment's placeholder-invoice pattern,
            // done as a raw insert so the row can be tagged with import_job_id.
            const { data: placeholder, error: placeholderErr } = await supabase
              .from('student_fees')
              .insert({
                school_id: schoolId,
                student_id: studentId,
                fee_structure_id: await getAnyFeeStructureId(schoolId),
                academic_year: academicYear || new Date().getFullYear().toString(),
                base_amount: 0,
                final_amount: 0,
                amount_paid: 0,
                status: 'pending',
                due_date: paymentDate,
                fee_breakdown: [],
                notes: 'Historical payment imported with no matching bill',
                import_job_id: jobId
              })
              .select('id')
              .single()
            if (placeholderErr) throw new Error(placeholderErr.message)
            studentFeeId = placeholder.id
          }

          const receipt = String(row.receipt_number || '').trim() || `IMP-${crypto.randomUUID().split('-')[0]}`
          const { error: payErr } = await supabase.from('fee_payments').insert({
            school_id: schoolId,
            student_fee_id: studentFeeId,
            amount,
            payment_method: row.payment_method ? String(row.payment_method).trim() : 'cash',
            payment_reference: row.payment_reference ? String(row.payment_reference).trim() : null,
            payment_date: paymentDate,
            notes: row.notes ? String(row.notes).trim() : 'Imported from school-data-import',
            receipt_number: receipt,
            import_job_id: jobId
          })
          if (payErr) throw new Error(payErr.message)

          touchedStudentFeeIds.add(studentFeeId)
          result.created++
        } catch (err: any) {
          result.failed++
          result.errors.push({ row: row._row, error: err.message || String(err) })
        }
      }

      // Defensive reconciliation: the fee_payments AFTER INSERT trigger
      // (update_fee_after_payment) already recomputes amount_paid/status on
      // every insert above, but re-running the same idempotent arithmetic
      // here once per touched invoice costs little and removes any doubt —
      // "trust but verify" rather than assuming the trigger behaved.
      for (const id of touchedStudentFeeIds) {
        try { await feesService.recomputeFeeBalance(id, schoolId) } catch { /* best-effort */ }
      }

      sheets.push(result)
    }

    const resultSummary: ImportResultSummary = { sheets, generated_credentials: credentials }
    await updateJob(jobId, {
      status: 'completed',
      progress_percent: 100,
      current_phase: null,
      result_summary: resultSummary,
      finished_at: new Date().toISOString()
    })
  } catch (err: any) {
    console.error(`[school-data-import] job ${jobId} failed:`, err)
    await updateJob(jobId, {
      status: 'failed',
      error_message: safeErrorMessage(err),
      result_summary: { sheets, generated_credentials: credentials },
      finished_at: new Date().toISOString()
    })
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function defaultDueDate(academicYear: string): string {
  // "2025-2026" -> first September of that year; falls back to today if the
  // label doesn't parse as a year range.
  const match = academicYear.match(/(\d{4})/)
  if (match) return `${match[1]}-09-05`
  return new Date().toISOString().slice(0, 10)
}

async function tagRowWithJob(
  table: 'students' | 'staff' | 'parents' | 'grade_levels' | 'sections' | 'subjects' | 'fee_categories',
  id: string,
  jobId: string
): Promise<void> {
  try {
    await supabase.from(table).update({ import_job_id: jobId }).eq('id', id)
  } catch (err) {
    console.error(`[school-data-import] failed to tag ${table}.${id} with job ${jobId}:`, err)
  }
}

async function findStudentIdByExternalId(schoolId: string, externalId: string): Promise<string | undefined> {
  const { data } = await supabase
    .from('students')
    .select('id')
    .eq('school_id', schoolId)
    .contains('custom_fields', { _import_external_id: externalId })
    .maybeSingle()
  return data?.id
}

async function getAnyFeeStructureId(schoolId: string): Promise<string | null> {
  const { data } = await supabase.from('fee_structures').select('id').eq('school_id', schoolId).limit(1).maybeSingle()
  return data?.id || null
}

async function getJobCreatedBy(jobId: string): Promise<string | null> {
  const { data } = await supabase.from('school_data_import_jobs').select('created_by').eq('id', jobId).maybeSingle()
  return data?.created_by || null
}

// ============================================================================
// JOB STATUS + ROLLBACK
// ============================================================================

export async function getImportJob(jobId: string, schoolId: string) {
  const { data, error } = await supabase
    .from('school_data_import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('school_id', schoolId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function listImportJobs(schoolId: string) {
  const { data, error } = await supabase
    .from('school_data_import_jobs')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

/**
 * Deletes every row tagged with this job's id, in reverse dependency order.
 * People-rows (students/staff/parents) are removed by deleting their auth
 * user, which cascades away the profile and every row that references it
 * (parents/staff/students all key off profile_id with ON DELETE CASCADE) —
 * the same pattern staff.controller.ts's deleteStaff already relies on.
 * Safe to call on a 'completed' or 'failed' job (a failed job may have
 * partially committed before the error) — never on one still 'running'.
 */
export async function rollbackImportJob(jobId: string, schoolId: string): Promise<{ rolled_back: boolean; errors: string[] }> {
  const job = await getImportJob(jobId, schoolId)
  if (!job) throw new Error('Import job not found')
  if (job.status === 'running' || job.status === 'queued' || job.status === 'validating') {
    throw new Error('Cannot roll back a job that is still in progress — wait for it to finish (or fail) first.')
  }

  // Every step's error is collected rather than swallowed — a rollback that
  // silently left rows behind (e.g. an FK violation because something else
  // was created against a job-created row after the fact) must not be
  // reported as a clean success. The job is only marked 'rolled_back' when
  // every step actually succeeded.
  const errors: string[] = []
  const del = async (table: string) => {
    const { error } = await supabase.from(table).delete().eq('import_job_id', jobId)
    if (error) errors.push(`${table}: ${error.message}`)
  }

  await del('fee_payments')
  await del('student_fees')
  await del('fee_structures')
  await del('fee_categories')

  const profileIds: string[] = []
  for (const table of ['students', 'staff', 'parents'] as const) {
    const { data, error } = await supabase.from(table).select('profile_id').eq('import_job_id', jobId)
    if (error) { errors.push(`${table}: ${error.message}`); continue }
    for (const row of data || []) if (row.profile_id) profileIds.push(row.profile_id)
  }
  for (const profileId of profileIds) {
    try {
      const { error } = await supabase.auth.admin.deleteUser(profileId)
      if (error) errors.push(`auth user ${profileId}: ${error.message}`)
    } catch (err: any) {
      errors.push(`auth user ${profileId}: ${err.message || String(err)}`)
    }
  }

  await del('subjects')
  await del('sections')
  await del('grade_levels')

  if (errors.length === 0) {
    await updateJob(jobId, { status: 'rolled_back' })
    return { rolled_back: true, errors: [] }
  }

  // Partial rollback — leave the job's status as-is (not 'rolled_back') so a
  // retry is obviously still needed, and surface exactly what failed.
  console.error(`[school-data-import] rollback of job ${jobId} had ${errors.length} error(s):`, errors)
  return { rolled_back: false, errors }
}

/**
 * Called once at server startup (see app.ts), mirroring
 * timetable-generation.service.ts's reconcileOrphanedJobs: any job left
 * 'queued'/'validating'/'running' from before a restart can never resume
 * (there is no row-level checkpoint — see the KNOWN LIMITATION note at the
 * top of this file) so it's marked 'failed' with a clear message. The
 * import is safe to retry from scratch afterwards: re-uploading and
 * re-validating the same workbook will skip everything the partially-run
 * job already created (grade/category code checks) or can be cleaned up
 * first with rollbackImportJob.
 */
export async function reconcileOrphanedImportJobs(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('school_data_import_jobs')
      .update({
        status: 'failed',
        error_message: 'Server restarted during import — re-upload and validate the workbook again (already-created rows were left in place; use the rollback action first if you want to start clean).',
        finished_at: new Date().toISOString()
      })
      .in('status', ['queued', 'validating', 'running'])
      .select('id')

    if (error) {
      console.error('[school-data-import] reconcileOrphanedImportJobs failed:', error)
      return
    }
    if (data && data.length > 0) {
      console.log(`[school-data-import] reconciled ${data.length} orphaned import job(s) from before restart`)
    }
  } catch (error) {
    console.error('[school-data-import] reconcileOrphanedImportJobs threw:', error)
  }
}
