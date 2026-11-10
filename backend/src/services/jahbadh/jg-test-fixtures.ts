// Test-only helpers shared by the Jahbadh service tests: a section context built from the memo, and the
// client's sample classes stored the way the platform stores them (jg_marks, sub-items, months, round 2).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { JG_DEFAULT_MONTH_NAMES, JG_DEFAULT_SCALE, jgGrade, subjectMeta } from '../../lib/jahbadh'
import { db } from './jg-test-db'
import type * as jg from './grades.service'

export function makeCtx(code: number, settings: Partial<jg.JgSettings> = {}, enterable?: string[]): jg.JgSectionContext {
  const version = '2026-2027'
  const def = jgGrade(code, version)!
  const rule: jg.JgRuleRow = {
    id: `r${code}`, school_id: 's1', version_label: version, grade_code: code, name: def.name, level: def.level, track: def.track,
    system_name: def.systemName, no_fail: def.noFail, total_min: def.totalMin, exam_min: def.examMin, stage_names: def.stageNames,
    rule_text: def.ruleText, certificate_name: def.certificateName, next_grade_name: def.nextGradeName, max_round2_subjects: def.maxRound2Subjects ?? 0,
  }
  const subjects: jg.JgLoadedSubject[] = def.subjects.map((s, i) => {
    const components: jg.JgComponentRow[] = s.stages.flatMap((comps, si) =>
      comps.map((c, ci) => {
        const id = `${s.key}-${si + 1}-${ci + 1}`
        return {
          id, subject_id: s.key, stage: si + 1, sort_order: ci + 1, name: c.name, max_score: c.max, is_exam: !!c.exam,
          monthly_kind: c.monthly ?? null, divisor: c.divisor ?? 1,
          subitems: (c.subItems ?? []).map((x, xi) => ({ id: `${id}-s${xi + 1}`, subject_id: s.key, component_id: id, sort_order: xi + 1, name: x.name, max_score: x.max })),
        }
      }),
    )
    return {
      id: s.key, key: s.key, name: s.name, short_name: s.name, weekly_periods: s.weeklyPeriods, display_order: i + 1, components,
      round2_subitems: (s.round2SubItems ?? []).map((x, xi) => ({ id: `${s.key}-r2-${xi + 1}`, subject_id: s.key, component_id: null, sort_order: xi + 1, name: x.name, max_score: x.max })),
      meta: subjectMeta(components.map((c) => ({ id: c.id, stage: c.stage, max: c.max_score, isExam: c.is_exam })), { noFail: def.noFail }),
    }
  })
  return {
    section: { id: 'sec1', name: 'أ', school_id: 's1', grade_level_id: `gl${code}` },
    gradeLevelName: def.name,
    rootId: 's1',
    yearId: 'y1',
    yearName: '2026 - 2027',
    version,
    settings: {
      version_label: version, follow_rate: 0.5, excel_rate: 0.85, grading_scale: JG_DEFAULT_SCALE, header: {},
      jabr_kasur: true, jabr_plus_one: true, act_mode: 'average', month_names: JG_DEFAULT_MONTH_NAMES.map((m) => [...m]), default_stage: null,
      ...settings,
    },
    grade: { rule, subjects },
    enterable: new Set(enterable ?? subjects.map((s) => s.id)),
  }
}

// ---- the client's sample classes (packages/shared-utils/src/jahbadh/__fixtures__) ------------------------

const FIX = resolve(__dirname, '../../../../packages/shared-utils/src/jahbadh/__fixtures__')
type Mark = number | 'غ'
type Entry = { value: Mark | null } | { months: (Mark | null)[] } | { subItems: Entry[] }
interface Fixture {
  settings: { actMode: 'average' | 'best_of_avg_last'; jabrKasur: boolean; jabrPlusOne: boolean; monthNames: string[][] }
  students: { no: number; name: string; gender: string | null; marks: Record<string, { stages: Entry[][]; round2: Entry | null }> }[]
}
export const f4: Record<string, { no: number; rank: string; decision: string }[]> = JSON.parse(readFileSync(resolve(FIX, 'f4-expected.json'), 'utf8'))

const base = { school_id: 's1', academic_year_id: 'y1', section_id: 'sec1', source: 'teacher' }
const markOf = (m: Mark | null) => (m === 'غ' ? { value: null, is_absent: true } : { value: m, is_absent: false })

/** Stores one sample class like the platform: jg_marks, jg_subitem_marks, jg_monthly_marks, jg_round2_marks. */
export function loadFixture(code: number) {
  const file: Fixture = JSON.parse(readFileSync(resolve(FIX, `grade-${String(code).padStart(2, '0')}.json`), 'utf8'))
  db.students = file.students.map((s) => ({ id: `st${s.no}`, section_id: 'sec1', student_number: String(s.no), profile: { first_name: s.name, gender: s.gender, is_active: true } }))
  db.jg_marks = []
  db.jg_subitem_marks = []
  db.jg_monthly_marks = []
  db.jg_round2_marks = []
  const put = (table: string, row: Record<string, unknown>) => db[table].push({ id: `m${db[table].length}`, ...base, ...row })
  const monthsInto = (studentId: string, target: { component_id?: string; subitem_id?: string }, months: (Mark | null)[]) =>
    months.forEach((m, i) => {
      if (m === null) return
      put('jg_monthly_marks', { student_id: studentId, component_id: target.component_id ?? null, subitem_id: target.subitem_id ?? null, target_id: target.component_id ?? target.subitem_id, month_idx: i, ...markOf(m) })
    })
  for (const s of file.students) {
    const sid = `st${s.no}`
    for (const [key, raw] of Object.entries(s.marks)) {
      raw.stages.forEach((comps, si) =>
        comps.forEach((e, ci) => {
          if (!e) return
          const cid = `${key}-${si + 1}-${ci + 1}`
          if ('value' in e) { if (e.value !== null) put('jg_marks', { student_id: sid, component_id: cid, ...markOf(e.value) }) }
          else if ('months' in e) monthsInto(sid, { component_id: cid }, e.months)
          else e.subItems.forEach((x, xi) => {
            const sub = `${cid}-s${xi + 1}`
            if ('value' in x) { if (x.value !== null) put('jg_subitem_marks', { student_id: sid, subitem_id: sub, ...markOf(x.value) }) }
            else if ('months' in x) monthsInto(sid, { subitem_id: sub }, x.months)
          })
        }),
      )
      const r2 = raw.round2
      if (r2) {
        const vals = 'value' in r2 ? [r2.value] : 'subItems' in r2 ? r2.subItems.map((x) => ('value' in x ? x.value : null)) : []
        const entered = vals.filter((v) => v !== null)
        if (entered.length) put('jg_round2_marks', { student_id: sid, jg_subject_id: key, value: entered.reduce<number>((a, v) => a + (v === 'غ' ? 0 : (v as number)), 0) })
      }
    }
  }
  return makeCtx(code, { act_mode: file.settings.actMode, jabr_kasur: file.settings.jabrKasur, jabr_plus_one: file.settings.jabrPlusOne, month_names: file.settings.monthNames })
}

