import { describe, expect, it } from 'vitest'

import {
  buildHaystacks,
  countBy,
  EMPTY_FILTER,
  experimentUrl,
  filterExperiments,
  isInsideLab,
  isLabHome,
  labName,
  normalizeSearch,
  parseCatalog,
  parseCodeList,
  pushRecent,
  type LabExperiment,
} from './model'

const BASE = 'https://istudent.ly/lab'
const EXPS: LabExperiment[] = [
  { code: 'P-E-001', ar: 'التدرّب على استخدام الأميتر', en: 'Practice using the ammeter', fr: "S'entraîner à utiliser l'ampèremètre", subject: 'physics', group: 'pe', level: 'ms' },
  { code: 'C-001', ar: 'الكواشف في الأحماض والقواعد', en: 'Indicators in acids and alkalis', subject: 'chemistry', group: 'c1', level: 'hs' },
  { code: 'SIM-163', en: 'Polygon sides', subject: 'maths', group: 'sim', kind: 'simulation' },
]
const HAY = buildHaystacks(EXPS)
const f = (over: Partial<typeof EMPTY_FILTER>) => ({ ...EMPTY_FILTER, ...over })
const none = new Set<string>()

describe('jahbadh lab catalog', () => {
  it('validates the catalog and drops entries with unsafe codes', () => {
    expect(parseCatalog('<html>')).toBeNull()
    expect(parseCatalog({ experiments: 'x' })).toBeNull()
    const c = parseCatalog({ version: 1, experiments: [...EXPS, { code: '../etc/passwd' }, { code: 5 }], subjects: [{ id: 'physics' }, { name: 'bad' }] })
    expect(c?.experiments).toHaveLength(3)
    expect(c?.subjects).toHaveLength(1)
    expect(c?.groups).toEqual([])
  })

  it('names fall back across languages', () => {
    expect(labName(EXPS[1], 'fr')).toBe('Indicators in acids and alkalis')
    expect(labName(EXPS[2], 'ar')).toBe('Polygon sides')
    expect(labName(undefined, 'en', 'X')).toBe('X')
  })

  it('searches Arabic without diacritics and across languages and codes', () => {
    expect(normalizeSearch('التَدَرُّب')).toBe(normalizeSearch('التدرب'))
    expect(filterExperiments(EXPS, HAY, f({ query: 'الأميتر' }), none).map((e) => e.code)).toEqual(['P-E-001'])
    expect(filterExperiments(EXPS, HAY, f({ query: 'ampèremètre' }), none).map((e) => e.code)).toEqual(['P-E-001'])
    expect(filterExperiments(EXPS, HAY, f({ query: 'sim 163' }), none).map((e) => e.code)).toEqual(['SIM-163'])
    expect(filterExperiments(EXPS, HAY, f({ query: 'sim 999' }), none)).toEqual([])
    expect(filterExperiments(EXPS, HAY, f({ query: 'sim-163' }), none).map((e) => e.code)).toEqual(['SIM-163'])
    expect(filterExperiments(EXPS, HAY, f({ query: 'acids indicators' }), none).map((e) => e.code)).toEqual(['C-001'])
  })

  it('combines subject, group, level and favourites filters', () => {
    expect(filterExperiments(EXPS, HAY, f({ subject: 'physics' }), none)).toHaveLength(1)
    expect(filterExperiments(EXPS, HAY, f({ subject: 'physics', group: 'c1' }), none)).toHaveLength(0)
    expect(filterExperiments(EXPS, HAY, f({ level: 'hs' }), none).map((e) => e.code)).toEqual(['C-001'])
    expect(filterExperiments(EXPS, HAY, f({ favouritesOnly: true }), new Set(['SIM-163'])).map((e) => e.code)).toEqual(['SIM-163'])
    expect(countBy(EXPS, 'subject').get('maths')).toBe(1)
  })

  it('keeps favourites and recent lists clean', () => {
    expect(parseCodeList('["P-E-001","../x",5,"C-001"]')).toEqual(['P-E-001', 'C-001'])
    expect(parseCodeList('not json')).toEqual([])
    expect(pushRecent(['A-1', 'B-2', 'C-3'], 'B-2', 3)).toEqual(['B-2', 'A-1', 'C-3'])
    expect(pushRecent(['A-1', 'B-2', 'C-3'], 'D-4', 3)).toEqual(['D-4', 'A-1', 'B-2'])
  })

  it('only lets the player stay inside the lab folder', () => {
    expect(isInsideLab(`${BASE}/P-E-001.html?lang=ar`, BASE)).toBe(true)
    expect(isInsideLab('about:blank', BASE)).toBe(true)
    expect(isInsideLab('https://istudent.ly/api/auth', BASE)).toBe(false)
    expect(isInsideLab('https://istudent.ly/laboratory/x.html', BASE)).toBe(false)
    expect(isInsideLab('https://istudent.ly.evil.com/lab/x.html', BASE)).toBe(false)
    expect(isInsideLab('javascript:alert(1)', BASE)).toBe(false)
    expect(isLabHome(`${BASE}/index.html?lang=en`, BASE)).toBe(true)
    expect(isLabHome(`${BASE}/`, BASE)).toBe(true)
    expect(isLabHome(`${BASE}/C-001.html`, BASE)).toBe(false)
    expect(experimentUrl(`${BASE}/`, 'C-001', 'fr')).toBe(`${BASE}/C-001.html?lang=fr`)
  })
})
