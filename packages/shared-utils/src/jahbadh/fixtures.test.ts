import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { jgGrade } from './distribution'
import { computeFixture, type FixtureFile } from './fixtures'

// The client's 14 sample classes («04 ملفات تجريبية», 30 students each; scripts/jahbadh-fixtures.ts).
// Brief §F4 lists every slot's expected result. Its totals and percentages were computed on the 2024-2025
// memo (grade 1 «/720», no Al-Quran or «التربية الوطنية»), while the sample files carry the 2026-2027
// subjects, so totals and the order of close neighbours differ. The decisions and who is ranked do not:
// every one of the 420 is asserted below. Our 2026-2027 totals, percentages and ranks are kept as a snapshot.
const dir = resolve(__dirname, '__fixtures__')
const load = (code: number): FixtureFile => JSON.parse(readFileSync(resolve(dir, `grade-${String(code).padStart(2, '0')}.json`), 'utf8'))
const f4: Record<string, { no: number; total: string; pct: string; rank: string; decision: string }[]> = JSON.parse(
  readFileSync(resolve(dir, 'f4-expected.json'), 'utf8'),
)

describe.each(Array.from({ length: 14 }, (_, i) => i + 1))('sample class, grade %i (brief §F4)', (code) => {
  const file = load(code)
  const rows = computeFixture(file)
  const grade = jgGrade(code)!

  it('reproduces every decision', () => {
    const got = rows.map((r) => `${r.no}: ${r.result.decision ?? '—'}`)
    const want = f4[code].map((e) => `${e.no}: ${e.decision}`)
    expect(got).toEqual(want)
  })

  it('ranks exactly the complete students; the twins (slots 4, 5) share a rank', () => {
    expect(rows.map((r) => r.rank === null)).toEqual(f4[code].map((e) => e.rank === '—'))
    expect(rows[3].rank).toBe(rows[4].rank)
    expect(rows[3].result.overall.total).toBe(rows[4].result.overall.total)
    expect(rows[0].rank).toBe(1)
  })

  it('says what is missing for the incomplete slots (24, 25); slot 26 has no marks', () => {
    expect(rows[23].result.missingText).toMatch(/^لم يُرصد بعد: .+ \(.+\)$/)
    expect(rows[24].result.missingText).toMatch(/\(كل الدرجات\)/)
    expect(rows[25].result.overall.total).toBeNull()
  })

  if (!grade.noFail) {
    it('slot 14: one mark short in the key subject, only failure → «جبر +1»', () => {
      expect(rows[13].result.subjects.filter((s) => s.jabr)).toHaveLength(1)
      // slot 18: 1 mark short + another failure → no bonus; slot 19 in 3rd secondary: 4 failures, the
      // 1-mark one is waived → 3 (within the Article 51 limit)
      expect(rows[17].result.subjects.some((s) => s.jabr)).toBe(false)
      expect(rows[18].result.subjects.some((s) => s.jabr)).toBe(code >= 13)
    })
  }

  if (grade.maxRound2Subjects) {
    it('slot 21: over the Article 51 limit → «راسب», out of the second round', () => {
      expect(rows[20].result.overRound2Limit).toBe(true)
    })
  }

  it('2026-2027 totals, percentages and ranks (snapshot)', () => {
    const table = rows.map((r) =>
      [r.no, r.result.overall.total ?? '—', r.result.overall.pct === null ? '—' : (r.result.overall.pct * 100).toFixed(2), r.rank ?? '—'].join(' '),
    )
    expect(table).toMatchSnapshot()
  })
})
