import ExcelJS from 'exceljs'

import { supabase } from '../../config/supabase'
import { StudentService } from '../student.service'
import { logJgAudit } from './audit.service'
import { JgError, type JgActor, type JgSectionContext } from './grades.service'

/**
 * Name import («استيراد الأسماء», brief B6 #25): paste a list (from the national system or any
 * file) or upload CSV/XLSX; columns are recognised from their headers (same patterns as the
 * workbook), each can be set by hand, then the rows create or update the section's students.
 * Nothing is written until `applyImport`. Admin only (route guard).
 */

export const JG_IMPORT_FIELDS = [
  'name', 'gender', 'nationality', 'registration_number', 'mother_name', 'place_of_birth',
  'birth_date', 'national_id', 'enrollment_status', 'registration_type', 'guardian_phone',
] as const
export type JgImportField = (typeof JG_IMPORT_FIELDS)[number]

export const JG_IMPORT_FIELD_LABELS: Record<JgImportField, string> = {
  name: 'الاسم', gender: 'الجنس', nationality: 'الجنسية', registration_number: 'رقم القيد', mother_name: 'اسم الأم',
  place_of_birth: 'مكان الميلاد', birth_date: 'تاريخ الميلاد', national_id: 'الرقم الوطني',
  enrollment_status: 'مستجد / معيد', registration_type: 'صفة القيد', guardian_phone: 'هاتف ولي الأمر',
}

/** Header patterns, tried in order (workbook «استيراد الأسماء» column D). */
const PATTERNS: Record<JgImportField, string[]> = {
  name: ['اسم الطالب', 'اسم التلميذ', 'الاسم', 'name'],
  gender: ['الجنس', 'النوع', 'gender'],
  nationality: ['الجنسية', 'nation'],
  registration_number: ['القيد', 'رقم التسجيل'],
  mother_name: ['اسم الأم', 'اسم الام', 'mother', 'الأم'],
  place_of_birth: ['مكان الميلاد', 'محل الميلاد', 'مكان'],
  birth_date: ['تاريخ الميلاد', 'الميلاد', 'birth'],
  national_id: ['الوطني', 'national'],
  enrollment_status: ['مستجد', 'معيد', 'الحالة'],
  registration_type: ['صفة'],
  guardian_phone: ['هاتف', 'جوال', 'موبايل', 'phone'],
}

export type JgImportMapping = Partial<Record<JgImportField, number>> // 1-based column, 0 = not used

export interface JgImportInput {
  text?: string
  file?: { buffer: Buffer; name?: string; mimetype?: string }
  has_header?: boolean
  mapping?: JgImportMapping
}

// ---- parsing -----------------------------------------------------------------------------------

function detectDelimiter(lines: string[]): string {
  const sample = lines.slice(0, 5).join('\n')
  const counts = ['\t', ',', ';'].map((d) => [d, sample.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : '\t'
}

/** CSV / TSV with quoted fields. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const delim = detectDelimiter(clean.split('\n').filter((l) => l.trim()))
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) { row.push(cell.trim()); cell = '' }
    else if (ch === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell.trim()); rows.push(row) }
  return rows.filter((r) => r.some((c) => c !== ''))
}

function cellText(v: any): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('result' in v) return cellText(v.result)
    if ('richText' in v) return (v.richText as any[]).map((r) => r.text).join('').trim()
    if ('text' in v) return String(v.text).trim()
  }
  return String(v).trim()
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer as any)
  } catch {
    throw new JgError(400, 'Could not read this file. Upload an .xlsx or .csv file, or paste the list.', 'bad_file')
  }
  const ws = wb.worksheets[0]
  if (!ws) return []
  const rows: string[][] = []
  ws.eachRow({ includeEmpty: false }, (r) => {
    const out: string[] = []
    r.eachCell({ includeEmpty: true }, (c, col) => { out[col - 1] = cellText(c.value) })
    rows.push(Array.from(out, (x) => x ?? ''))
  })
  return rows.filter((r) => r.some((c) => c !== ''))
}

async function readTable(input: JgImportInput): Promise<string[][]> {
  if (input.file) {
    const name = (input.file.name ?? '').toLowerCase()
    const isXlsx = name.endsWith('.xlsx') || input.file.mimetype?.includes('spreadsheetml') || input.file.buffer.subarray(0, 2).toString() === 'PK'
    return isXlsx ? parseXlsx(input.file.buffer) : parseDelimited(input.file.buffer.toString('utf8'))
  }
  if (typeof input.text === 'string' && input.text.trim()) return parseDelimited(input.text)
  throw new JgError(400, 'Paste the list or upload a file', 'empty')
}

/** Detects each field's column from the header row (1-based, 0 = not found). */
export function detectColumns(headers: string[]): Record<JgImportField, number> {
  const low = headers.map((h) => h.toLowerCase())
  const out = {} as Record<JgImportField, number>
  for (const f of JG_IMPORT_FIELDS) {
    out[f] = 0
    for (const p of PATTERNS[f]) {
      const i = low.findIndex((h) => h.includes(p.toLowerCase()))
      if (i >= 0) { out[f] = i + 1; break }
    }
  }
  return out
}

// ---- values ------------------------------------------------------------------------------------

/** Arabic name normalisation for matching (hamza forms, ta marbuta, alif maqsura, tatweel, spaces). */
export const normName = (s: string) =>
  s.replace(/ـ/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim()

const COMPOUND_PREFIXES = new Set(['عبد', 'ابو', 'أبو', 'بو'])

/** Splits a full Arabic name into first / father / grandfather / last (compounds like «عبد الله» stay together). */
export function splitName(full: string): { first: string; father: string; grandfather: string; last: string } | null {
  const words = full.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const parts: string[] = []
  for (let i = 0; i < words.length; i++) {
    if (COMPOUND_PREFIXES.has(words[i]) && i + 1 < words.length) { parts.push(`${words[i]} ${words[i + 1]}`); i++ }
    else parts.push(words[i])
  }
  if (parts.length < 2) return null
  if (parts.length === 2) return { first: parts[0], father: '', grandfather: '', last: parts[1] }
  if (parts.length === 3) return { first: parts[0], father: parts[1], grandfather: '', last: parts[2] }
  return { first: parts[0], father: parts[1], grandfather: parts.slice(2, -1).join(' '), last: parts[parts.length - 1] }
}

const GENDER: Record<string, 'male' | 'female'> = {
  'ذكر': 'male', 'أنثى': 'female', 'انثى': 'female', 'ذ': 'male', 'أ': 'female', 'ا': 'female',
  male: 'male', female: 'female', m: 'male', f: 'female',
}
export const parseGender = (v: string): 'male' | 'female' | null => (v ? GENDER[v.trim().toLowerCase()] ?? null : null)

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO date from 2014-03-05, 05/03/2014, 5-3-2014 or an Excel serial number; null when not a date. */
export function parseDate(v: string): string | null {
  const s = v.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  if (!s) return null
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (m) return valid(+m[3], +m[2], +m[1])
  if (/^\d{4,5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000)
    return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  return null
  function valid(y: number, mo: number, d: number) {
    if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    return dt.getUTCMonth() === mo - 1 ? `${y}-${pad(mo)}-${pad(d)}` : null
  }
}

/** «مكان وتاريخ الميلاد» in one cell: the date part, and what remains as the place. */
function splitPlaceDate(v: string): { place: string; date: string | null } {
  const m = v.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/)
  if (!m) return { place: v.trim(), date: null }
  return { place: v.replace(m[0], '').replace(/[-–،,]+\s*$/, '').replace(/^\s*[-–،,]+/, '').trim(), date: parseDate(m[0]) }
}

const ENROLLMENT = new Set(['مستجد', 'معيد'])
const REG_TYPE = new Set(['نظامي', 'منازل'])

// ---- preview -----------------------------------------------------------------------------------

export interface JgImportIssue { level: 'error' | 'warning'; field?: JgImportField; message: string }

export interface JgImportRow {
  line: number
  values: Partial<Record<JgImportField, string>>
  name_parts: { first: string; father: string; grandfather: string; last: string } | null
  gender: 'male' | 'female' | null
  birth_date: string | null
  match: { student_id: string; by: 'registration_number' | 'national_id' | 'name' } | null
  action: 'create' | 'update' | 'skip'
  issues: JgImportIssue[]
}

export interface JgImportPreview {
  has_header: boolean
  headers: string[]
  columns: number
  detected: Record<JgImportField, number>
  mapping: Record<JgImportField, number>
  first_values: Partial<Record<JgImportField, string>>
  fields: { key: JgImportField; label: string }[]
  rows: JgImportRow[]
  counts: { total: number; create: number; update: number; skip: number; errors: number; warnings: number }
}

interface SectionStudentKey { id: string; name: string; registration_number: string | null; national_id: string | null }

async function sectionStudentKeys(sectionId: string): Promise<SectionStudentKey[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, registration_number, profile:profiles(first_name, father_name, grandfather_name, last_name, national_id)')
    .eq('section_id', sectionId)
  if (error) throw error
  return (data ?? []).map((s: any) => {
    const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
    return {
      id: s.id,
      name: normName([p?.first_name, p?.father_name, p?.grandfather_name, p?.last_name].filter(Boolean).join(' ')),
      registration_number: s.registration_number ?? null,
      national_id: p?.national_id ?? null,
    }
  })
}

/** National IDs already used by students elsewhere in the school family (outside this section). */
async function nationalIdsElsewhere(ctx: JgSectionContext, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data, error } = await supabase
    .from('profiles')
    .select('national_id, students!inner(section_id, school_id)')
    .in('national_id', ids)
  if (error) throw error
  const out = new Set<string>()
  for (const r of data ?? []) {
    const st = (Array.isArray((r as any).students) ? (r as any).students : [(r as any).students]).filter(Boolean)
    if (st.some((s: any) => s.section_id !== ctx.section.id)) out.add((r as any).national_id)
  }
  return out
}

export async function previewImport(ctx: JgSectionContext, input: JgImportInput): Promise<JgImportPreview> {
  const table = await readTable(input)
  if (!table.length) throw new JgError(400, 'The list is empty', 'empty')
  if (table.length > 1001) throw new JgError(400, 'At most 1000 students per import', 'too_many')
  const hasHeader = input.has_header !== false
  const headers = hasHeader ? table[0] : []
  const columns = Math.max(...table.map((r) => r.length))
  const detected = hasHeader ? detectColumns(headers) : (Object.fromEntries(JG_IMPORT_FIELDS.map((f) => [f, 0])) as Record<JgImportField, number>)
  const mapping = { ...detected }
  for (const f of JG_IMPORT_FIELDS) {
    const m = input.mapping?.[f]
    if (m !== undefined && m !== null) {
      const n = Number(m)
      if (!Number.isInteger(n) || n < 0 || n > columns) throw new JgError(400, `Column for ${JG_IMPORT_FIELD_LABELS[f]} must be 0–${columns}`, 'bad_mapping')
      mapping[f] = n
    }
  }
  if (!mapping.name) throw new JgError(400, 'Choose the column that holds the student name', 'no_name_column')

  const body = hasHeader ? table.slice(1) : table
  const existing = await sectionStudentKeys(ctx.section.id)
  const byReg = new Map(existing.filter((e) => e.registration_number).map((e) => [String(e.registration_number), e.id]))
  const byNid = new Map(existing.filter((e) => e.national_id).map((e) => [String(e.national_id), e.id]))
  const byName = new Map<string, string[]>()
  for (const e of existing) byName.set(e.name, [...(byName.get(e.name) ?? []), e.id])

  const seenReg = new Map<string, number>()
  const seenNid = new Map<string, number>()
  const nids = body.map((r) => (mapping.national_id ? (r[mapping.national_id - 1] ?? '').trim() : '')).filter(Boolean)
  const elsewhere = await nationalIdsElsewhere(ctx, [...new Set(nids)])

  const rows: JgImportRow[] = body.map((r, i) => {
    const line = i + 1 + (hasHeader ? 1 : 0)
    const values: Partial<Record<JgImportField, string>> = {}
    for (const f of JG_IMPORT_FIELDS) if (mapping[f]) values[f] = (r[mapping[f] - 1] ?? '').trim()
    const issues: JgImportIssue[] = []

    // Place and date of birth may share one column.
    let birthDate: string | null = null
    if (values.birth_date) {
      if (mapping.birth_date === mapping.place_of_birth) {
        const pd = splitPlaceDate(values.birth_date)
        birthDate = pd.date
        values.place_of_birth = pd.place
      } else birthDate = parseDate(values.birth_date)
      if (!birthDate) issues.push({ level: 'warning', field: 'birth_date', message: 'تاريخ الميلاد غير مقروء' })
    }

    const nameParts = values.name ? splitName(values.name) : null
    if (!values.name) issues.push({ level: 'error', field: 'name', message: 'الاسم فارغ' })
    else if (!nameParts) issues.push({ level: 'error', field: 'name', message: 'الاسم يحتاج اسمين على الأقل' })

    const gender = values.gender ? parseGender(values.gender) : null
    if (values.gender && !gender) issues.push({ level: 'warning', field: 'gender', message: 'الجنس: ذكر أو أنثى' })
    if (values.enrollment_status && !ENROLLMENT.has(values.enrollment_status)) issues.push({ level: 'warning', field: 'enrollment_status', message: 'مستجد أو معيد' })
    if (values.registration_type && !REG_TYPE.has(values.registration_type)) issues.push({ level: 'warning', field: 'registration_type', message: 'نظامي أو منازل' })

    const reg = values.registration_number || ''
    if (reg) {
      if (seenReg.has(reg)) issues.push({ level: 'error', field: 'registration_number', message: `رقم القيد مكرر (السطر ${seenReg.get(reg)})` })
      else seenReg.set(reg, line)
    }
    const nid = values.national_id || ''
    if (nid) {
      if (!/^\d{12}$/.test(nid)) issues.push({ level: 'warning', field: 'national_id', message: 'الرقم الوطني 12 رقماً' })
      if (seenNid.has(nid)) issues.push({ level: 'error', field: 'national_id', message: `الرقم الوطني مكرر (السطر ${seenNid.get(nid)})` })
      else seenNid.set(nid, line)
      if (elsewhere.has(nid) && !byNid.has(nid)) issues.push({ level: 'error', field: 'national_id', message: 'الرقم الوطني مسجل لطالب آخر في المدرسة' })
    }

    let match: JgImportRow['match'] = null
    if (reg && byReg.has(reg)) match = { student_id: byReg.get(reg)!, by: 'registration_number' }
    else if (nid && byNid.has(nid)) match = { student_id: byNid.get(nid)!, by: 'national_id' }
    else if (values.name) {
      const same = byName.get(normName(values.name)) ?? []
      if (same.length === 1) match = { student_id: same[0], by: 'name' }
      else if (same.length > 1) issues.push({ level: 'warning', field: 'name', message: 'أكثر من طالب بهذا الاسم في الشعبة؛ سيُضاف طالب جديد' })
    }
    const action: JgImportRow['action'] = issues.some((x) => x.level === 'error') ? 'skip' : match ? 'update' : 'create'
    return { line, values, name_parts: nameParts, gender, birth_date: birthDate, match, action, issues }
  })

  const first = rows[0]?.values ?? {}
  return {
    has_header: hasHeader,
    headers,
    columns,
    detected,
    mapping,
    first_values: first,
    fields: JG_IMPORT_FIELDS.map((key) => ({ key, label: JG_IMPORT_FIELD_LABELS[key] })),
    rows,
    counts: {
      total: rows.length,
      create: rows.filter((r) => r.action === 'create').length,
      update: rows.filter((r) => r.action === 'update').length,
      skip: rows.filter((r) => r.action === 'skip').length,
      errors: rows.reduce((n, r) => n + r.issues.filter((x) => x.level === 'error').length, 0),
      warnings: rows.reduce((n, r) => n + r.issues.filter((x) => x.level === 'warning').length, 0),
    },
  }
}

// ---- apply -------------------------------------------------------------------------------------

export interface JgImportResult {
  created: number
  updated: number
  skipped: number
  failed: { line: number; message: string }[]
  /** New accounts' sign-in details (admins hand them out); passwords must be changed at first sign-in. */
  credentials: { line: number; student_id: string; name: string; username: string | null; password: string | null }[]
  /** Columns that exist only after jahbadh_wave2.sql (مستجد/معيد, صفة القيد) and were not stored. */
  not_stored: JgImportField[]
}

const studentService = new StudentService()

/** Optional columns added by jahbadh_wave2.sql; a missing column is reported, not fatal. */
async function writeOptional(studentId: string, patch: Record<string, string>, notStored: Set<JgImportField>) {
  for (const [col, field] of [['enrollment_status', 'enrollment_status'], ['registration_type', 'registration_type']] as const) {
    if (!(col in patch)) continue
    const { error } = await supabase.from('students').update({ [col]: patch[col] }).eq('id', studentId)
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') notStored.add(field)
      else throw error
    }
  }
}

async function mergeGuardianPhone(studentId: string, phone: string) {
  const { data, error } = await supabase.from('students').select('custom_fields').eq('id', studentId).maybeSingle()
  if (error) throw error
  const cf = { ...((data as any)?.custom_fields ?? {}), guardian_phone: phone }
  const { error: ue } = await supabase.from('students').update({ custom_fields: cf }).eq('id', studentId)
  if (ue) throw ue
}

export async function applyImport(ctx: JgSectionContext, input: JgImportInput, actor: JgActor): Promise<JgImportResult> {
  const preview = await previewImport(ctx, input)
  const result: JgImportResult = { created: 0, updated: 0, skipped: preview.counts.skip, failed: [], credentials: [], not_stored: [] }
  const notStored = new Set<JgImportField>()

  for (const row of preview.rows) {
    if (row.action === 'skip' || !row.name_parts) continue
    const v = row.values
    const common = {
      ...(row.gender ? { gender: row.gender } : {}),
      ...(row.birth_date ? { date_of_birth: row.birth_date } : {}),
      ...(v.national_id ? { national_id: v.national_id } : {}),
      ...(v.nationality ? { nationality: v.nationality } : {}),
      ...(v.mother_name ? { mother_name: v.mother_name } : {}),
      ...(v.place_of_birth ? { place_of_birth: v.place_of_birth } : {}),
      ...(v.registration_number ? { registration_number: v.registration_number } : {}),
    }
    const names = {
      first_name: row.name_parts.first,
      father_name: row.name_parts.father || undefined,
      grandfather_name: row.name_parts.grandfather || undefined,
      last_name: row.name_parts.last,
    }
    try {
      let studentId: string
      if (row.action === 'update' && row.match) {
        // Matched students keep their names (a shorter imported name would mix with the stored parts);
        // the other given fields are updated.
        studentId = row.match.student_id
        if (Object.keys(common).length) await studentService.updateStudent(studentId, ctx.section.school_id, common, actor.role)
        result.updated++
      } else {
        const created = await studentService.createStudent({
          school_id: ctx.section.school_id,
          grade_level_id: ctx.section.grade_level_id,
          section_id: ctx.section.id,
          ...names,
          ...common,
        } as any)
        studentId = created.id
        result.created++
        result.credentials.push({
          line: row.line, student_id: created.id, name: v.name ?? '',
          username: created.generated_username ?? null, password: created.generated_password ?? null,
        })
      }
      const optional: Record<string, string> = {}
      if (v.enrollment_status && ENROLLMENT.has(v.enrollment_status)) optional.enrollment_status = v.enrollment_status
      if (v.registration_type && REG_TYPE.has(v.registration_type)) optional.registration_type = v.registration_type
      await writeOptional(studentId, optional, notStored)
      if (v.guardian_phone) await mergeGuardianPhone(studentId, v.guardian_phone)
    } catch (e: any) {
      result.failed.push({ line: row.line, message: e?.message || 'Failed' })
    }
  }
  result.not_stored = [...notStored]

  await logJgAudit({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'students.import', entity: 'students',
    sectionId: ctx.section.id,
    after: { created: result.created, updated: result.updated, skipped: result.skipped, failed: result.failed.length, mapping: preview.mapping },
  })
  return result
}
