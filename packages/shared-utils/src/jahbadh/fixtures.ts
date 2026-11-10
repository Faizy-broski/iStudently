/**
 * Turns the raw marks of a sample workbook (scripts/jahbadh-fixtures.ts) into engine inputs, the same
 * way the platform stores and computes them: monthly components from their months, components with
 * sub-items from Σ ÷ divisor, then `resolveStudent` with the section's completeness. Test-only.
 */
import { jgGrade, type JgComponentDef, type JgGradeDef } from './distribution'
import {
  maskMonths,
  monthlyMark,
  resolveStudent,
  sectionRanks,
  sectionStagesOf,
  subItemsValue,
  computeSubject,
  type JgActMode,
  type JgCell,
  type JgStudentResult,
  type JgStudentSubjectInput,
} from './engine'
import { jgComponentsOf, jgRuleOf } from './index'

export type FixtureMark = number | 'غ'
export type FixtureEntry = { value: FixtureMark | null } | { months: (FixtureMark | null)[] } | { subItems: FixtureEntry[] }

export interface FixtureFile {
  grade: number
  file: string
  settings: { actMode: JgActMode; jabrKasur: boolean; jabrPlusOne: boolean; monthNames: string[][] }
  students: {
    no: number
    name: string
    gender: string | null
    regNo: string | number | null
    status: string | null
    marks: Record<string, { stages: FixtureEntry[][]; round2: FixtureEntry | null }>
  }[]
}

const toCell = (m: FixtureMark | null): JgCell | undefined =>
  m === null ? undefined : m === 'غ' ? { value: null, absent: true } : { value: m }
const num = (m: FixtureMark | null) => (typeof m === 'number' ? m : null)

function entryCell(entry: FixtureEntry, comp: Pick<JgComponentDef, 'monthly' | 'divisor'>, months: string[], actMode: JgActMode): JgCell | undefined {
  if ('value' in entry) return toCell(entry.value)
  if ('months' in entry) {
    const v = monthlyMark(maskMonths(entry.months.map(num), months), comp.monthly ?? 'applications', actMode)
    return v === null ? undefined : { value: v }
  }
  const items = entry.subItems.map((sub) => entryCell(sub, { monthly: comp.monthly }, months, actMode))
  const v = subItemsValue(items, comp.divisor)
  return v.value === null && !v.absent ? undefined : v
}

/** Engine input of one student's subjects. */
export function fixtureInputs(file: FixtureFile, student: FixtureFile['students'][number], grade: JgGradeDef): JgStudentSubjectInput[] {
  const { actMode, monthNames } = file.settings
  return grade.subjects.map((subject) => {
    const raw = student.marks[subject.key]
    const components = jgComponentsOf(subject)
    const cells: Record<string, JgCell> = {}
    subject.stages.forEach((comps, si) =>
      comps.forEach((comp, ci) => {
        const entry = raw?.stages[si]?.[ci]
        if (!entry) return
        const cell = entryCell(entry, comp, monthNames[si] ?? [], actMode)
        if (cell) cells[`${si + 1}.${ci + 1}`] = cell
      }),
    )
    let round2: number | null = null
    if (raw?.round2) {
      const c = entryCell(raw.round2, {}, [], actMode)
      round2 = c && !c.absent ? c.value : c?.absent ? 0 : null
    }
    return { key: subject.key, name: subject.name, components, cells, round2 }
  })
}

export interface FixtureRow {
  no: number
  name: string
  result: JgStudentResult
  rank: number | null
}

/** Computes a whole sample class as the platform would. */
export function computeFixture(file: FixtureFile, version?: string): FixtureRow[] {
  const grade = jgGrade(file.grade, version)!
  const rule = jgRuleOf(grade)
  const inputs = file.students.map((s) => fixtureInputs(file, s, grade))
  const sectionStages = sectionStagesOf(
    inputs.flatMap((subjects) => subjects.map((s) => ({ key: s.key, result: computeSubject(s.components, s.cells, null, rule) }))),
  )
  const results = inputs.map((subjects) =>
    resolveStudent(subjects, { ...grade, stageNames: [...grade.stageNames] }, { settings: file.settings, sectionStages }),
  )
  const ranks = sectionRanks(results)
  return file.students.map((s, i) => ({ no: s.no, name: s.name, result: results[i], rank: ranks[i] }))
}
