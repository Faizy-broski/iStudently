/**
 * Extracts the raw marks of the client's 14 sample workbooks («04 ملفات تجريبية», 30 students each)
 * into JSON fixtures (src/jahbadh/__fixtures__/grade-NN.json) for the engine regression tests.
 *   npx tsx packages/shared-utils/scripts/jahbadh-fixtures.ts [path/to/«04 ملفات تجريبية»]
 *
 * Only what a teacher types is kept (the workbooks are saved without cached results): per student,
 * subject, stage and component either a direct mark, the months of a monthly component, or its
 * sub-items (each a direct mark or months). The engine recomputes everything else.
 * Needs the `unzip` command (no npm dependency).
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JG_SUBJECT_SHORT_NAMES, jgGrade } from '../src/jahbadh/distribution'

const ROOT = resolve(__dirname, '../../..')
const DIR = process.argv[2] ?? resolve(ROOT, 'منظومة جهبذ 2026-2027 — الحزمة الكاملة/04 ملفات تجريبية')
const OUT = resolve(__dirname, '../src/jahbadh/__fixtures__')
const BRIEF = resolve(DIR, '../07 For the developer (English)/Jahbadh_Assessment_Suite_Brief.md')

// ---- minimal xlsx reader ------------------------------------------------------------------------

type Mark = number | 'غ'
interface Cell {
  v: string | number | null
  f: string | null
}
type Grid = Map<string, Cell>

const unzip = (file: string, entry: string) =>
  execFileSync('unzip', ['-p', file, entry], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8')
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)
const key = (row: number, col: number) => `${row}:${col}`

function workbook(file: string) {
  const wb = unzip(file, 'xl/workbook.xml')
  const rels = unzip(file, 'xl/_rels/workbook.xml.rels')
  const target = new Map(
    [...rels.matchAll(/<Relationship ([^>]*)\/?>/g)].map((m) => [m[1].match(/Id="([^"]+)"/)![1], m[1].match(/Target="([^"]+)"/)![1]]),
  )
  const sheets = new Map<string, string>()
  for (const m of wb.matchAll(/<sheet ([^>]*)\/>/g)) {
    const name = decode(m[1].match(/name="([^"]+)"/)![1])
    const rid = m[1].match(/r:id="([^"]+)"/)![1]
    sheets.set(name, `xl/${target.get(rid)!.replace(/^\/?xl\//, '')}`)
  }
  let shared: string[] = []
  try {
    shared = [...unzip(file, 'xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
      decode([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
    )
  } catch {
    shared = []
  }
  const cache = new Map<string, Grid>()
  return (name: string): Grid => {
    if (cache.has(name)) return cache.get(name)!
    const path = sheets.get(name)
    if (!path) throw new Error(`${file}: no sheet ${name}`)
    const grid: Grid = new Map()
    for (const m of unzip(file, path).matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = m[4] ?? ''
      const t = m[3].match(/t="([^"]+)"/)?.[1]
      const f = body.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1]
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let value: string | number | null = null
      if (t === 'inlineStr') value = decode([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''))
      else if (t === 's' && v !== undefined) value = shared[Number(v)]
      else if (v !== undefined && v !== '') value = t === 'str' || t === 'e' ? decode(v) : Number(v)
      grid.set(key(Number(m[2]), colNum(m[1])), { v: value, f: f ? decode(f) : null })
    }
    cache.set(name, grid)
    return grid
  }
}

const mark = (v: Cell['v']): Mark | null => {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim() === 'غ') return 'غ'
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

// ---- raw shapes written to the fixtures -----------------------------------------------------------

/** One entered thing: a mark, the 4 months of a monthly component, or sub-items. */
export type RawEntry = { value: Mark | null } | { months: (Mark | null)[] } | { subItems: RawEntry[] }

const LOG = 'سجل الأنشطة الشهري'
const range = (f: string) => {
  const m = f.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/)
  if (!m) return null
  const cols: number[] = []
  for (let c = colNum(m[1]); c <= colNum(m[3]); c++) cols.push(c)
  return cols
}

function extract(file: string, code: number) {
  const sheet = workbook(file)
  const grade = jgGrade(code)!
  const log = sheet(LOG)
  const main = sheet('الرئيسية')

  // settings
  const label = (text: string) => {
    for (const [k, c] of main) if (c.v === text) return main.get(key(Number(k.split(':')[0]), 4))?.v ?? null
    return null
  }
  let monthRow = 0
  for (const [k, c] of main) if (c.v === 'المرحلة') monthRow = Number(k.split(':')[0])
  const monthNames = [1, 2, 3].map((i) => [10, 11, 12, 13].map((col) => String(main.get(key(monthRow + i, col))?.v ?? '')))
  const settings = {
    actMode: label('حساب الأنشطة الشهرية') === 'المتوسط' ? 'average' : 'best_of_avg_last',
    jabrKasur: label('جبر الكسور لصالح الطالب (م 122)') === 'نعم',
    jabrPlusOne: label('درجة واحدة في مادة واحدة للنجاح (م 122)') === 'نعم',
    monthNames,
  }

  // students
  const names = sheet('الأسماء')
  const students = Array.from({ length: 30 }, (_, i) => {
    const r = 3 + i
    const g = (c: number) => names.get(key(r, c))?.v ?? null
    return { no: Number(g(1)), name: (g(2) as string | null) ?? '', gender: g(3), nationality: g(4), regNo: g(5), status: g(9) }
  })

  const logValue = (f: string): Mark | null => {
    const m = f.match(new RegExp(`'${LOG}'!\\$?([A-Z]+)\\$?(\\d+)`))
    if (!m) return null
    return mark(log.get(key(Number(m[2]), colNum(m[1])))?.v ?? null)
  }
  const monthsOf = (grid: Grid, cols: number[], row: number) =>
    cols.map((c) => {
      const cell = grid.get(key(row, c))
      if (!cell) return null
      if (!cell.f) return mark(cell.v)
      return logValue(cell.f)
    })
  /** A sub-item column: a typed mark, or the months behind a branch mark. */
  const subEntry = (grid: Grid, col: number, row: number): RawEntry => {
    const cell = grid.get(key(row, col))
    if (!cell?.f) return { value: mark(cell?.v ?? null) }
    const cols = /AVERAGE\(/.test(cell.f) ? range(cell.f) : null
    if (!cols) throw new Error(`${file}: unknown sub-item formula ${col}@${row}: ${cell.f}`)
    return { months: monthsOf(grid, cols, row) }
  }
  const slotEntry = (grid: Grid, col: number, row: number): RawEntry => {
    const cell = grid.get(key(row, col))
    if (!cell?.f) return { value: mark(cell?.v ?? null) }
    const cols = range(cell.f)
    if (!cols) throw new Error(`${file}: unknown slot formula ${col}@${row}: ${cell.f}`)
    if (/AVERAGE\(/.test(cell.f)) return { months: monthsOf(grid, cols, row) }
    if (/SUM\(/.test(cell.f)) return { subItems: cols.map((c) => subEntry(grid, c, row)) }
    throw new Error(`${file}: unknown slot formula ${col}@${row}: ${cell.f}`)
  }

  const subjects = grade.subjects.map((subject) => {
    const grid = sheet(JG_SUBJECT_SHORT_NAMES[subject.key])
    // stage totals: IF(COUNT(AY6:BD6)=0,"",IF(Jabr="نعم",… — their range is the stage's 6 component slots
    const blocks: number[][] = []
    for (const [k, c] of grid) {
      const [r] = k.split(':').map(Number)
      if (r !== 6 || !c.f || !/^IF\(COUNT\([A-Z]+6:[A-Z]+6\)=0,"",IF\(Jabr=/.test(c.f)) continue
      blocks.push(range(c.f)!)
    }
    blocks.sort((a, b) => a[0] - b[0])
    // one block per stage (semester grades keep an empty third block)
    const stages = subject.stages.map((comps, i) => (comps.length ? i : -1)).filter((i) => i >= 0)
    if (blocks.length < stages.length || stages.some((i) => i >= blocks.length))
      throw new Error(`${file} ${subject.key}: ${blocks.length} stage blocks, expected ${stages.length}`)
    let r2col = 0
    for (const [k, c] of grid) if (c.v === 'امتحان الدور الثاني' && k.startsWith('2:')) r2col = Number(k.split(':')[1])
    return { subject, grid, blocks, stages, r2col }
  })

  const out = students.map((st, i) => {
    const row = 6 + i
    const marks: Record<string, { stages: RawEntry[][]; round2: RawEntry | null }> = {}
    for (const { subject, grid, blocks, stages, r2col } of subjects) {
      const stageEntries: RawEntry[][] = [[], [], []]
      for (const stageIdx of stages) {
        stageEntries[stageIdx] = subject.stages[stageIdx].map((_, k) => slotEntry(grid, blocks[stageIdx][k], row))
      }
      let round2: RawEntry | null = null
      if (r2col) {
        const cell = grid.get(key(row, r2col))
        if (cell?.f && /SUM\(/.test(cell.f)) round2 = { subItems: range(cell.f)!.map((c) => subEntry(grid, c, row)) }
        else if (!cell?.f) round2 = { value: mark(cell?.v ?? null) }
      }
      marks[subject.key] = { stages: stageEntries, round2 }
    }
    return { ...st, marks }
  })
  return { grade: code, file: file.split('/').pop(), settings, students: out }
}

mkdirSync(OUT, { recursive: true })
for (const name of readdirSync(DIR).filter((f) => f.endsWith('.xlsx')).sort()) {
  const code = Number(name.match(/— (\d+) —/)![1])
  const data = extract(resolve(DIR, name), code)
  const path = resolve(OUT, `grade-${String(code).padStart(2, '0')}.json`)
  writeFileSync(path, JSON.stringify(data))
  console.log(`${name} → ${path}`)
}

// Brief §F4: the expected total, %, rank and decision of every slot (computed on the 2024-2025 memo).
const brief = readFileSync(BRIEF, 'utf8').split('\n')
const f4: Record<number, { no: number; total: string; pct: string; rank: string; decision: string }[]> = {}
for (let code = 1; code <= 14; code++) {
  let i = brief.findIndex((l) => l.startsWith(`### F4.${code} `))
  while (!brief[i].startsWith('| #')) i++
  f4[code] = []
  for (i += 2; brief[i]?.startsWith('| '); i++) {
    const [no, total, pct, rank, decision] = brief[i].split('|').slice(1, -1).map((x) => x.trim())
    f4[code].push({ no: Number(no), total, pct, rank, decision })
  }
}
writeFileSync(resolve(OUT, 'f4-expected.json'), JSON.stringify(f4, null, 1))
console.log('wrote f4-expected.json')
