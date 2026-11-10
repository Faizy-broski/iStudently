/**
 * Generates src/jahbadh/distribution-2026-2027.ts from the client's brief (Appendix A: grades,
 * subjects, components; Appendix B: sub-items). Re-run when the brief changes:
 *   npx tsx packages/shared-utils/scripts/jahbadh-parse-memo.ts [path/to/Jahbadh_Assessment_Suite_Brief.md]
 * Then: sh packages/shared-utils/scripts/sync-jahbadh-engine.sh
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { JgComponentDef, JgGradeDef, JgMonthlyKind, JgSubItemDef, JgSubjectDef, JgSubjectKey } from '../src/jahbadh/distribution'

const ROOT = resolve(__dirname, '../../..')
const BRIEF =
  process.argv[2] ??
  resolve(ROOT, 'منظومة جهبذ 2026-2027 — الحزمة الكاملة/07 For the developer (English)/Jahbadh_Assessment_Suite_Brief.md')
const OUT = resolve(__dirname, '../src/jahbadh/distribution-2026-2027.ts')
const VERSION = '2026-2027'

const md = readFileSync(BRIEF, 'utf8').split('\n')
const between = (start: RegExp, end: RegExp) => {
  const a = md.findIndex((l) => start.test(l))
  const b = md.findIndex((l, i) => i > a && end.test(l))
  if (a < 0 || b < 0) throw new Error(`section not found: ${start}`)
  return md.slice(a, b)
}
const appendixA = between(/^# APPENDIX A/, /^# APPENDIX B/)
const appendixB = between(/^# APPENDIX B/, /^## F4\./)

/** Official name → stable key (prefix match, longest first). */
const KEYS: [string, JgSubjectKey][] = [
  ['القرآن الكريم', 'quran'],
  ['التربية الإسلامية', 'islamic'],
  ['التربية الوطنية', 'national'],
  ['اللغة العربية', 'arabic'],
  ['الكتابة', 'writing'],
  ['اللغة الإنجليزية', 'english'],
  ['الرياضيات', 'math'],
  ['العلوم', 'science'],
  ['الاجتماعيات', 'social'],
  ['التاريخ', 'history'],
  ['الجغرافيا', 'geography'],
  ['الحاسوب', 'computer'],
  ['تقنية المعلومات', 'it'],
  ['الفيزياء', 'physics'],
  ['الكيمياء', 'chemistry'],
  ['الأحياء', 'biology'],
  ['الإحصاء', 'statistics'],
  ['الفلسفة', 'philosophy'],
  ['علم الاجتماع', 'sociology'],
  ['علم النفس', 'psychology'],
]
const keyOf = (name: string): JgSubjectKey => {
  const hit = KEYS.find(([prefix]) => name === prefix || name.startsWith(`${prefix} `) || name.startsWith(`${prefix}(`))
  if (!hit) throw new Error(`unknown subject: ${name}`)
  return hit[1]
}

/** Not in Appendix A: the grade named in «ينقل إلى الصف …». */
const NEXT_GRADE: Record<number, string | null> = {
  1: 'الثاني', 2: 'الثالث', 3: 'الرابع', 4: 'الخامس', 5: 'السادس', 6: 'السابع', 7: 'الثامن', 8: 'التاسع', 9: null,
  10: 'الثاني الثانوي (علمي أو أدبي)', 11: 'الثالث الثانوي — علمي', 12: 'الثالث الثانوي — أدبي', 13: null, 14: null,
}

/** How a component is recorded month by month (brief B4, B5-14; workbook «سجل الأنشطة الشهري»). */
function monthlyKind(code: number, key: JgSubjectKey, comp: { name: string; exam?: boolean }): JgMonthlyKind | undefined {
  if (comp.exam) return undefined
  if (code <= 3 && (key === 'english' || key === 'math')) return 'items'
  if (comp.name.includes('الأنشطة')) return 'activity'
  if (comp.name.includes('التطبيقات') || comp.name.includes('الاختبارات التحريرية')) return 'applications'
  return undefined
}

const num = (s: string) => {
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`not a number: ${s}`)
  return n
}
const cells = (line: string) => line.split('|').slice(1, -1).map((c) => c.trim())
const isRow = (line: string) => line.startsWith('| ') && !/^\|\s*(Subject|---)/.test(line) && !line.startsWith('|---')

function parseComponents(field: string): JgComponentDef[] {
  if (field === '—' || field === '') return []
  return field.split(/;\s*/).map((part) => {
    const m = part.trim().match(/^(.*\S)\s+([\d.]+)(\s*★)?$/)
    if (!m) throw new Error(`bad component: ${part}`)
    return m[3] ? { name: m[1], max: num(m[2]), exam: true } : { name: m[1], max: num(m[2]) }
  })
}

const pct = (s: string) => {
  const m = s.match(/\*\*(\d+)%\*\*/)
  return m ? num(m[1]) / 100 : 0
}

// ---- Appendix A --------------------------------------------------------------------------------

const grades: JgGradeDef[] = []
let current: JgGradeDef | null = null
for (const line of appendixA) {
  const head = line.match(/^#### A\.(\d+) — .* — (الصف .+)$/)
  if (head) {
    const code = num(head[1])
    const name = head[2].replace(/^الصف /, '').trim()
    current = {
      code, name, level: code <= 9 ? 'basic' : 'secondary',
      track: name.includes('علمي') ? 'science' : name.includes('أدبي') ? 'humanities' : null,
      systemName: '', noFail: false, totalMin: 0, examMin: 0, stageNames: ['', '', null], ruleText: '',
      certificateName: null, nextGradeName: NEXT_GRADE[code] ?? null, maxRound2Subjects: code >= 13 ? 3 : 0, subjects: [],
    }
    grades.push(current)
    continue
  }
  if (!current) continue
  if (line.startsWith('- System:')) {
    const parts = line.split('|')
    current.systemName = parts[0].match(/\*\*(.+?)\*\*/)![1]
    current.noFail = /\*\*yes\*\*/.test(parts[1])
    current.totalMin = pct(parts[2])
    current.examMin = pct(parts[3])
    current.certificateName = current.systemName.startsWith('شهادة') ? current.systemName : null
  } else if (line.startsWith('- Stages:')) {
    const names = line.replace('- Stages:', '').split(' / ').map((s) => s.trim())
    current.stageNames = [names[0], names[1], names[2] && names[2] !== '—' ? names[2] : null]
  } else if (line.startsWith('- Official rule text')) {
    current.ruleText = line.match(/«(.+)»/)![1]
  } else if (isRow(line)) {
    const [name, periods, s1, s2, s3, total] = cells(line)
    const key = keyOf(name)
    const subject: JgSubjectDef = {
      key, name, weeklyPeriods: num(periods),
      stages: [parseComponents(s1), parseComponents(s2), parseComponents(s3)],
    }
    for (const stage of subject.stages) {
      for (const comp of stage) {
        const kind = monthlyKind(current.code, key, comp)
        if (kind) comp.monthly = kind
      }
    }
    const sum = subject.stages.flat().reduce((a, c) => a + c.max, 0)
    if (Math.abs(sum - num(total)) > 1e-9) throw new Error(`${current.code} ${name}: components ${sum} ≠ total ${total}`)
    current.subjects.push(subject)
  } else {
    const t = line.match(/^\*Grade total: (\d+)\*/)
    if (t) {
      const sum = current.subjects.flatMap((s) => s.stages.flat()).reduce((a, c) => a + c.max, 0)
      if (sum !== num(t[1])) throw new Error(`grade ${current.code}: ${sum} ≠ ${t[1]}`)
    }
  }
}
if (grades.length !== 14) throw new Error(`expected 14 grades, got ${grades.length}`)

// ---- Appendix B --------------------------------------------------------------------------------

let grade: JgGradeDef | null = null
let attached = 0
for (const line of appendixB) {
  const head = line.match(/^#### B\.(\d+) — /)
  if (head) {
    grade = grades.find((g) => g.code === num(head[1])) ?? null
    continue
  }
  if (!grade || !isRow(line)) continue
  const [subjectShort, stagesField, compField, itemsField, sumField, divField] = cells(line)
  const subject = grade.subjects.find((s) => s.key === keyOf(subjectShort))
  if (!subject) throw new Error(`B.${grade.code}: subject ${subjectShort} not taught`)
  const cm = compField.match(/^(.*\S)\s*\(([\d.]+)\)$/)
  if (!cm) throw new Error(`bad component cell: ${compField}`)
  const subItems: JgSubItemDef[] = itemsField.split(/،\s*/).map((part) => {
    const m = part.trim().match(/^(.*\S)\s+([\d.]+)$/)
    if (!m) throw new Error(`bad sub-item: ${part}`)
    return { name: m[1], max: num(m[2]) }
  })
  const sigma = subItems.reduce((a, s) => a + s.max, 0)
  if (Math.abs(sigma - num(sumField)) > 1e-9) throw new Error(`B.${grade.code} ${subjectShort} ${compField}: Σ ${sigma} ≠ ${sumField}`)
  const divisor = divField === '—' ? 1 : num(divField.replace('÷', ''))
  if (Math.abs(sigma / divisor - num(cm[2])) > 1e-9) throw new Error(`B.${grade.code} ${subjectShort} ${compField}: Σ÷${divisor} ≠ max`)
  if (stagesField === 'R2') {
    subject.round2SubItems = subItems
    attached++
    continue
  }
  const stageNames = stagesField.split(' / ').map((s) => s.trim())
  for (const sn of stageNames) {
    const idx = grade.stageNames.findIndex((n) => n === sn)
    if (idx < 0) throw new Error(`B.${grade.code}: unknown stage ${sn}`)
    const comp = subject.stages[idx].find((c) => c.name === cm[1] && c.max === num(cm[2]))
    if (!comp) throw new Error(`B.${grade.code} ${subjectShort}: no component ${compField} in ${sn}`)
    comp.subItems = subItems.map((s) => ({ ...s }))
    if (divisor !== 1) comp.divisor = divisor
    attached++
  }
}

// ---- write -------------------------------------------------------------------------------------

const lit = (v: unknown): string => JSON.stringify(v)
const compLit = (c: JgComponentDef) => {
  const parts = [`name: ${lit(c.name)}`, `max: ${c.max}`]
  if (c.exam) parts.push('exam: true')
  if (c.monthly) parts.push(`monthly: ${lit(c.monthly)}`)
  if (c.subItems) parts.push(`subItems: [${c.subItems.map((s) => `{ name: ${lit(s.name)}, max: ${s.max} }`).join(', ')}]`)
  if (c.divisor) parts.push(`divisor: ${c.divisor}`)
  return `{ ${parts.join(', ')} }`
}

const out: string[] = [
  '/**',
  ` * Official grade distribution ${VERSION} — GENERATED by scripts/jahbadh-parse-memo.ts from the brief`,
  ' * (Appendix A: subjects and components; Appendix B: sub-items). Do not edit by hand: re-run the script.',
  ' */',
  "import type { JgGradeDef } from './distribution'",
  '',
  `export const JG_DISTRIBUTION_2026_2027: JgGradeDef[] = [`,
]
for (const g of grades) {
  out.push('  {')
  out.push(`    code: ${g.code}, name: ${lit(g.name)}, level: ${lit(g.level)}, track: ${lit(g.track)},`)
  out.push(`    systemName: ${lit(g.systemName)}, noFail: ${g.noFail}, totalMin: ${g.totalMin}, examMin: ${g.examMin}, maxRound2Subjects: ${g.maxRound2Subjects},`)
  out.push(`    stageNames: ${lit(g.stageNames)},`)
  out.push(`    ruleText: ${lit(g.ruleText)},`)
  out.push(`    certificateName: ${lit(g.certificateName)}, nextGradeName: ${lit(g.nextGradeName)},`)
  out.push('    subjects: [')
  for (const s of g.subjects) {
    out.push(`      { key: ${lit(s.key)}, name: ${lit(s.name)}, weeklyPeriods: ${s.weeklyPeriods}, stages: [`)
    for (const stage of s.stages) out.push(`        [${stage.map(compLit).join(', ')}],`)
    out.push(
      s.round2SubItems
        ? `      ], round2SubItems: [${s.round2SubItems.map((x) => `{ name: ${lit(x.name)}, max: ${x.max} }`).join(', ')}] },`
        : '      ] },',
    )
  }
  out.push('    ],')
  out.push('  },')
}
out.push(']', '')
writeFileSync(OUT, out.join('\n'))
console.log(`wrote ${OUT}: ${grades.length} grades, ${attached} sub-item sets`)
