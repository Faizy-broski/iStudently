import { describe, expect, it } from 'vitest'

import {
  buildLabCatalog, compareLabCodes, labKindOfSubject, labSubjectOfCode, labSubjectOfGroup, parseLabIndex, scrapeLabNames, type LabFileInput,
} from './lab-catalog'

// A tiny index.html shaped like the client's launcher (data as JSON, labels as JS literals).
const DATA = [
  { code: 'P-E-001', ar: 'الأميتر', en: "Use the ammeter", fr: "S'entraîner", g: 'pe', lv: 'ms' },
  { code: 'P-E-002', ar: 'دائرة', en: 'Circuit', fr: 'Circuit', g: 'pe', lv: 'zms' },
  { code: 'SIM-001', ar: 'محاكاة', en: 'Cross-sections', fr: 'Sections', g: 'simmath', lv: 'm' },
  { code: 'A-H-001', ar: 'القلب', en: 'Heart', fr: 'Cœur', g: 'ana' },
  { code: 'HOW-001', ar: '', en: 'Washing machine', fr: '', g: 'howhome', lv: 'p' },
  { code: 'TOOL-001', ar: 'مصمم', en: 'Designer', fr: 'Concepteur', g: 'tool', lv: 'pms' },
  { code: 'C-009', ar: 'x', en: 'x', fr: 'x', g: 'lab' },
]
const GROUPS = [
  ['pe', 'فيزياء · الكهرباء', 'Physics · Electricity', 'Physique · Électricité'],
  ['simmath', 'محاكاة · الرياضيات', 'Simulations · Mathematics', 'Simulations · Mathématiques'],
  ['ana', 'النماذج', 'Anatomical models', 'Modèles'],
  ['howhome', 'كيف · البيت', 'How · At home', 'Comment · Maison'],
  ['tool', 'أدوات', 'Tools', 'Outils'],
  ['lab', 'مختبر', 'Lab', 'Labo'],
  ['gs', 'جيو', 'Geo', 'Géo'],
]
const INDEX_HTML = `<html><head><style>.x{content:"[{"}</style></head><body><script>
const DATA=${JSON.stringify(DATA)}
,GROUPS=${JSON.stringify(GROUPS)};
const SUBJ=[['sim',{ar:'المحاكاة',en:'Simulations',fr:'Simulations'}],['how',{ar:'كيف',en:'How things work',fr:'Comment ça marche ?'}],['phy',{ar:'الفيزياء',en:'Physics',fr:'Physique'}],['chem',{ar:'الكيمياء',en:'Chemistry',fr:'Chimie'}],['geo',{ar:'الأرض',en:'Earth',fr:'Terre'}],['anat',{ar:'نماذج',en:'3D models',fr:'Modèles 3D'}],['tool',{ar:'أدوات',en:'Tools',fr:'Outils'}]];
const STG={'':{ar:'كل',en:'All',fr:'Tous'}},STS={p:{ar:'ابتدائي',en:'Primary',fr:'Primaire'},m:{ar:'إعدادي',en:'Middle',fr:'Collège'},s:{ar:'ثانوي',en:'Secondary',fr:'Lycée'}},STL={ar:'x'};
</script></body></html>`

const file = (code: string, html = ''): LabFileInput => ({ code, source: 'dir', read: () => html })
const NOW = '2026-11-25T00:00:00.000Z'

describe('parseLabIndex', () => {
  it('reads data, groups, subjects and levels as text', () => {
    const idx = parseLabIndex(INDEX_HTML)
    expect(idx.data).toHaveLength(7)
    expect(idx.data[0]).toMatchObject({ code: 'P-E-001', g: 'pe', lv: 'ms', fr: "S'entraîner" })
    expect(idx.groups.map((g) => g.id)).toEqual(['pe', 'simmath', 'ana', 'howhome', 'tool', 'lab', 'gs'])
    expect(idx.subjects.map((s) => s.id)).toEqual(['sim', 'how', 'phy', 'chem', 'geo', 'anat', 'tool'])
    expect(idx.subjects[1].fr).toBe('Comment ça marche ?')
    expect(idx.levels.map((l) => l.id)).toEqual(['p', 'm', 's'])
  })
  it('fails loudly on a page without a catalog', () => {
    expect(() => parseLabIndex('<html></html>')).toThrow(/DATA/)
  })
})

describe('subjects and kinds', () => {
  it('maps groups like the lab launcher does', () => {
    expect(labSubjectOfGroup('simphy')).toBe('sim')
    expect(labSubjectOfGroup('howcar')).toBe('how')
    expect(labSubjectOfGroup('ana')).toBe('anat')
    expect(labSubjectOfGroup('anc')).toBe('anat')
    expect(labSubjectOfGroup('gas')).toBe('chem')
    expect(labSubjectOfGroup('gm')).toBe('geo')
    expect(labSubjectOfGroup('bp')).toBe('bio')
    expect(labSubjectOfGroup('pe')).toBe('phy')
    expect(labSubjectOfGroup('lab')).toBe('chem')
    expect(labSubjectOfGroup('tool')).toBe('tool')
  })
  it('derives kinds and the file-name family subject', () => {
    expect(labKindOfSubject('sim')).toBe('simulation')
    expect(labKindOfSubject('how')).toBe('howto')
    expect(labKindOfSubject('tool')).toBe('tool')
    expect(labKindOfSubject('anat')).toBe('model')
    expect(labKindOfSubject('phy')).toBe('experiment')
    expect(labSubjectOfCode('P-ES-004')).toBe('phy')
    expect(labSubjectOfCode('M-X-003')).toBe('sim')
    expect(labSubjectOfCode('B-X-010')).toBe('bio')
    expect(labSubjectOfCode('G-F-001')).toBe('geo')
    expect(labSubjectOfCode('A-C-001')).toBe('anat')
    expect(labSubjectOfCode('C-X-050')).toBe('chem')
  })
})

describe('buildLabCatalog with an index', () => {
  const index = parseLabIndex(INDEX_HTML)
  const files = ['P-E-002', 'P-E-001', 'SIM-001', 'A-H-001', 'HOW-001', 'TOOL-001', 'C-009'].map((c) => file(c))
  const { catalog, report } = buildLabCatalog({ index, files, generatedAt: NOW })

  it('builds the contract shape in natural code order', () => {
    expect(catalog.version).toBe(1)
    expect(catalog.generated_at).toBe(NOW)
    expect(catalog.count).toBe(7)
    expect(catalog.experiments.map((e) => e.code)).toEqual(['A-H-001', 'C-009', 'HOW-001', 'P-E-001', 'P-E-002', 'SIM-001', 'TOOL-001'])
    const e = catalog.experiments.find((x) => x.code === 'P-E-001')!
    expect(e).toEqual({ code: 'P-E-001', ar: 'الأميتر', en: 'Use the ammeter', fr: "S'entraîner", subject: 'phy', group: 'pe', level: 'ms', kind: 'experiment' })
  })
  it('sets kinds, drops unknown level letters and omits an empty level', () => {
    const by = (c: string) => catalog.experiments.find((x) => x.code === c)!
    expect(by('SIM-001').kind).toBe('simulation')
    expect(by('HOW-001').kind).toBe('howto')
    expect(by('TOOL-001').kind).toBe('tool')
    expect(by('A-H-001').kind).toBe('model')
    expect(by('P-E-002').level).toBe('ms')
    expect(by('A-H-001').level).toBeUndefined()
    expect(report.badLevels).toEqual(['P-E-002'])
  })
  it('fills a missing language from another and reports it', () => {
    const how = catalog.experiments.find((x) => x.code === 'HOW-001')!
    expect(how).toMatchObject({ ar: 'Washing machine', en: 'Washing machine', fr: 'Washing machine' })
    expect(report.partialNames).toEqual(['HOW-001'])
    expect(report.unnamed).toEqual([])
  })
  it('keeps only groups and subjects that have experiments', () => {
    expect(catalog.groups.map((g) => g.id)).toEqual(['pe', 'simmath', 'ana', 'howhome', 'tool', 'lab'])
    expect(catalog.groups.find((g) => g.id === 'pe')).toMatchObject({ subject: 'phy', en: 'Physics · Electricity' })
    expect(report.emptyGroups).toEqual(['gs'])
    expect(catalog.subjects.map((s) => s.id)).toEqual(['sim', 'how', 'phy', 'chem', 'anat', 'tool'])
    expect(catalog.levels.map((l) => l.id)).toEqual(['p', 'm', 's'])
    expect(report.bySubject).toMatchObject({ phy: 2, sim: 1, anat: 1, how: 1, tool: 1, chem: 1 })
  })
  it('is deterministic for the same input', () => {
    const again = buildLabCatalog({ index, files: [...files].reverse(), generatedAt: NOW })
    expect(JSON.stringify(again.catalog)).toBe(JSON.stringify(catalog))
  })
})

describe('buildLabCatalog gaps and merging', () => {
  const index = parseLabIndex(INDEX_HTML)
  it('reports index entries without a file and leaves them out', () => {
    const { catalog, report } = buildLabCatalog({ index, files: [file('P-E-001')], generatedAt: NOW })
    expect(catalog.count).toBe(1)
    expect(report.indexEntriesWithoutFile).toContain('SIM-001')
  })
  it('names a file the index does not list from its own text, else uses the code', () => {
    const html = "x EXPS['B-C-001']=TBC({code:'B-C-001',\n title:t('المجهر','The microscope','Le microscope'),goal:t('a','b','c')})"
    const { catalog, report } = buildLabCatalog({ index, files: [file('P-E-001'), file('B-C-001', html), file('B-C-002', 'nothing here')], generatedAt: NOW })
    const b1 = catalog.experiments.find((x) => x.code === 'B-C-001')!
    expect(b1).toMatchObject({ ar: 'المجهر', en: 'The microscope', fr: 'Le microscope', subject: 'bio', group: 'b-c', kind: 'experiment' })
    expect(catalog.experiments.find((x) => x.code === 'B-C-002')).toMatchObject({ en: 'B-C-002', ar: 'B-C-002', fr: 'B-C-002' })
    expect(report.filesWithoutIndexEntry).toEqual(['B-C-001', 'B-C-002'])
    expect(report.scraped).toEqual(['B-C-001'])
    expect(report.unnamed).toEqual(['B-C-002'])
    expect(catalog.groups.find((g) => g.id === 'b-c')).toMatchObject({ subject: 'bio' })
  })
  it('works without an index (default subjects and levels)', () => {
    const { catalog } = buildLabCatalog({ index: null, files: [file('P-F-001', "title:N3('ق','F','F')"), file('SIM-005')], generatedAt: NOW })
    expect(catalog.subjects.map((s) => s.id)).toEqual(['sim', 'phy'])
    expect(catalog.levels.map((l) => l.id)).toEqual(['p', 'm', 's'])
    expect(catalog.count).toBe(2)
  })
  it('keeps the first folder on duplicate codes and skips unsafe names', () => {
    const a: LabFileInput = { code: 'P-E-001', source: 'one', read: () => '' }
    const b: LabFileInput = { code: 'P-E-001', source: 'two', read: () => '' }
    const { catalog, report } = buildLabCatalog({ index, files: [a, b, file('../evil'), file('a b')], generatedAt: NOW })
    expect(catalog.count).toBe(1)
    expect(report.duplicates).toEqual(['P-E-001'])
    expect(report.skippedFiles).toEqual(['../evil', 'a b'])
  })
})

describe('helpers', () => {
  it('orders codes naturally', () => {
    expect(['P-E-10', 'P-E-9', 'P-ES-1', 'C-1'].sort(compareLabCodes)).toEqual(['C-1', 'P-E-9', 'P-E-10', 'P-ES-1'])
  })
  it('scrapes N3 and t titles near the code', () => {
    expect(scrapeLabNames("code:'X-1', title:N3('a','b','c')", 'X-1')).toEqual({ ar: 'a', en: 'b', fr: 'c' })
    expect(scrapeLabNames("EXPS['X-1']=Q({title:t('a\\'s','b','c')})", 'X-1')).toEqual({ ar: "a's", en: 'b', fr: 'c' })
    expect(scrapeLabNames("code:'X-2'", 'X-1')).toBeNull()
  })
})
