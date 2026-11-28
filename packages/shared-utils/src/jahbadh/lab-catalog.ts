/**
 * Jahbadh Lab catalog builder (pure, no file access).
 *
 * The client's lab folder holds ~1,800 self-contained HTML experiments plus an `index.html` launcher
 * whose script carries the whole catalog (`const DATA=[…]`, `GROUPS=[…]`, `SUBJ=[…]`, `STS={…}`).
 * We read that script as TEXT (never evaluated) and emit a clean `catalog.json` for the platform;
 * files the index does not list get their names scraped from the file text (`title:t('ar','en','fr')`
 * or `N3(...)`), falling back to the code itself.
 *
 * The output shape is the contract in packages/shared-types/src/jahbadh-lab.ts (that package cannot
 * be imported here, so the interfaces below are kept structurally identical).
 */

export type LabKind = 'experiment' | 'simulation' | 'howto' | 'tool' | 'model'

export interface LabNames {
  ar: string
  en: string
  fr: string
}
export interface LabSubject extends LabNames {
  id: string
}
export interface LabGroup extends LabNames {
  id: string
  subject: string
}
export interface LabLevel extends LabNames {
  id: string
}
export interface LabExperiment extends LabNames {
  code: string
  subject: string
  group: string
  level?: string
  kind: LabKind
}
export interface LabCatalog {
  version: 1
  generated_at: string
  count: number
  subjects: LabSubject[]
  groups: LabGroup[]
  levels: LabLevel[]
  experiments: LabExperiment[]
}

/** Raw rows of the lab's own index.html. */
export interface ParsedLabIndex {
  data: { code: string; ar: string; en: string; fr: string; g: string; lv?: string }[]
  groups: { id: string; ar: string; en: string; fr: string }[]
  subjects: LabSubject[]
  levels: LabLevel[]
}

export interface LabFileInput {
  /** File name without `.html`. */
  code: string
  /** Directory it came from (only used in the report). */
  source: string
  /** Reads the file text lazily (only called for files the index does not name). */
  read: () => string
}

export interface LabCatalogReport {
  total: number
  bySubject: Record<string, number>
  byGroup: Record<string, number>
  /** Codes whose name came from the file text instead of the index. */
  scraped: string[]
  /** Codes with no name at all (the code is used as the name). */
  unnamed: string[]
  /** Index entries missing a name in some language (filled from another language). */
  partialNames: string[]
  /** Files that have no entry in the index. */
  filesWithoutIndexEntry: string[]
  /** Index entries without a file (left out of the catalog). */
  indexEntriesWithoutFile: string[]
  /** Codes present more than once across the folders (the first folder wins). */
  duplicates: string[]
  /** File names that are not safe to put in a URL (skipped). */
  skippedFiles: string[]
  /** Groups of the index that have no experiment (left out of the catalog). */
  emptyGroups: string[]
  /** Level letters in the index that are not a known level (dropped). */
  badLevels: string[]
}

export const LAB_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

// ---- subjects, kinds, levels ---------------------------------------------------------------------

/** Same grouping as the lab's own launcher (`subjOf` in index.html). */
export function labSubjectOfGroup(group: string): string {
  const k = group
  return k === 'sch' ? 'sch'
    : k === 'det' ? 'det'
    : k === 'eng' ? 'eng'
    : k.startsWith('how') ? 'how'
    : k === 'tool' ? 'tool'
    : k === 'ana' || k === 'anc' ? 'anat'
    : k.startsWith('sim') ? 'sim'
    : k[0] === 'g' && k !== 'gas' ? 'geo'
    : k[0] === 'b' ? 'bio'
    : k[0] === 'p' ? 'phy'
    : 'chem'
}

export function labKindOfSubject(subject: string): LabKind {
  return subject === 'sim' ? 'simulation' : subject === 'how' ? 'howto' : subject === 'tool' ? 'tool' : subject === 'anat' ? 'model' : 'experiment'
}

/** Subject by the file-name family, for files the index does not list. */
export function labSubjectOfCode(code: string): string {
  const family = code.toUpperCase().replace(/-\d+$/, '')
  const head = family.split('-')[0]
  if (family === 'M-X') return 'sim'
  const byHead: Record<string, string> = { P: 'phy', C: 'chem', B: 'bio', G: 'geo', A: 'anat', M: 'sim', SIM: 'sim', HOW: 'how', SCH: 'sch', DET: 'det', ENG: 'eng', TOOL: 'tool' }
  return byHead[head] ?? 'chem'
}

const DEFAULT_SUBJECTS: LabSubject[] = [
  { id: 'sim', ar: 'المحاكاة التفاعلية', en: 'Simulations', fr: 'Simulations' },
  { id: 'how', ar: 'كيف تعمل الأشياء؟', en: 'How things work', fr: 'Comment ça marche ?' },
  { id: 'sch', ar: 'على خطى العلماء', en: 'In the footsteps of scientists', fr: 'Sur les pas des savants' },
  { id: 'det', ar: 'المحقق العلمي', en: 'The science detective', fr: 'Le détective scientifique' },
  { id: 'eng', ar: 'ابنِ وجرّب', en: 'Build and test', fr: 'Construis et teste' },
  { id: 'phy', ar: 'الفيزياء', en: 'Physics', fr: 'Physique' },
  { id: 'chem', ar: 'الكيمياء', en: 'Chemistry', fr: 'Chimie' },
  { id: 'bio', ar: 'الأحياء', en: 'Biology', fr: 'Biologie' },
  { id: 'geo', ar: 'علوم الأرض والفضاء', en: 'Earth & space', fr: 'Terre et espace' },
  { id: 'anat', ar: 'النماذج المجسّمة', en: '3D models', fr: 'Modèles 3D' },
  { id: 'tool', ar: 'أدوات', en: 'Tools', fr: 'Outils' },
]

const DEFAULT_LEVELS: LabLevel[] = [
  { id: 'p', ar: 'ابتدائي', en: 'Primary', fr: 'Primaire' },
  { id: 'm', ar: 'إعدادي', en: 'Middle', fr: 'Collège' },
  { id: 's', ar: 'ثانوي', en: 'Secondary', fr: 'Lycée' },
]

// ---- reading the lab's index.html (text only) ----------------------------------------------------

/** Index of the bracket that closes the one at `start` (`[`/`{`), skipping quoted strings. */
function matchClose(text: string, start: number): number {
  const open = text[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  let quote = ''
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'") quote = c
    else if (c === open) depth++
    else if (c === close && --depth === 0) return i
  }
  throw new Error('Unbalanced brackets in the lab index')
}

/** Literal after `marker` (first occurrence at or after `from`), from its opening bracket to the matching close. */
function literalAfter(text: string, marker: string, from = 0): { src: string; end: number } {
  const at = text.indexOf(marker, from)
  if (at < 0) throw new Error(`The lab index has no "${marker}" block`)
  let s = at + marker.length
  while (s < text.length && /\s/.test(text[s])) s++
  if (text[s] !== '[' && text[s] !== '{') throw new Error(`"${marker}" is not followed by an array or object`)
  const e = matchClose(text, s)
  return { src: text.slice(s, e + 1), end: e + 1 }
}

const unescapeJs = (s: string) => s.replace(/\\(['"\\])/g, '$1')
const JS_STR = String.raw`'((?:[^'\\]|\\.)*)'`

function namesFrom(m: RegExpExecArray, at: number): LabNames {
  return { ar: unescapeJs(m[at]), en: unescapeJs(m[at + 1]), fr: unescapeJs(m[at + 2]) }
}

export function parseLabIndex(html: string): ParsedLabIndex {
  const dataLit = literalAfter(html, 'const DATA=')
  const rawData = JSON.parse(dataLit.src) as unknown
  if (!Array.isArray(rawData)) throw new Error('DATA is not an array')
  const data: ParsedLabIndex['data'] = []
  for (const row of rawData) {
    const r = row as Record<string, unknown>
    if (!r || typeof r.code !== 'string' || typeof r.g !== 'string') continue
    data.push({
      code: r.code,
      ar: String(r.ar ?? ''),
      en: String(r.en ?? ''),
      fr: String(r.fr ?? ''),
      g: r.g,
      lv: typeof r.lv === 'string' ? r.lv : undefined,
    })
  }

  const groupsLit = literalAfter(html, 'GROUPS=', dataLit.end)
  const rawGroups = JSON.parse(groupsLit.src) as unknown
  if (!Array.isArray(rawGroups)) throw new Error('GROUPS is not an array')
  const groups: ParsedLabIndex['groups'] = []
  for (const g of rawGroups) {
    if (Array.isArray(g) && typeof g[0] === 'string') groups.push({ id: g[0], ar: String(g[1] ?? ''), en: String(g[2] ?? ''), fr: String(g[3] ?? '') })
  }

  const subjects: LabSubject[] = []
  const subjLit = literalAfter(html, 'const SUBJ=', groupsLit.end)
  const subjRe = new RegExp(String.raw`\[\s*'([a-z]+)'\s*,\s*\{\s*ar:\s*${JS_STR}\s*,\s*en:\s*${JS_STR}\s*,\s*fr:\s*${JS_STR}\s*\}\s*\]`, 'g')
  for (let m = subjRe.exec(subjLit.src); m; m = subjRe.exec(subjLit.src)) subjects.push({ id: m[1], ...namesFrom(m, 2) })

  const levels: LabLevel[] = []
  const levelLit = literalAfter(html, 'STS=', groupsLit.end)
  const levelRe = new RegExp(String.raw`([a-z]+):\s*\{\s*ar:\s*${JS_STR}\s*,\s*en:\s*${JS_STR}\s*,\s*fr:\s*${JS_STR}\s*\}`, 'g')
  for (let m = levelRe.exec(levelLit.src); m; m = levelRe.exec(levelLit.src)) levels.push({ id: m[1], ...namesFrom(m, 2) })

  if (data.length === 0) throw new Error('The lab index lists no experiments')
  return { data, groups, subjects, levels }
}

// ---- names scraped from a lab file ---------------------------------------------------------------

/** `title:t('ar','en','fr')` / `N3(...)` of the file's own experiment, or null. */
export function scrapeLabNames(html: string, code: string): LabNames | null {
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const anchor = new RegExp(String.raw`(?:code:\s*'${escaped}'|EXPS\['${escaped}'\]|\(\s*'${escaped}'\s*,\s*\{)`)
  const a = anchor.exec(html)
  if (!a) return null
  const window = html.slice(a.index, a.index + 6000)
  const title = new RegExp(String.raw`title:\s*(?:t|N3)\(\s*${JS_STR}\s*,\s*${JS_STR}\s*,\s*${JS_STR}\s*\)`).exec(window)
  return title ? namesFrom(title, 1) : null
}

// ---- building ------------------------------------------------------------------------------------

/** Natural order: letters by code unit, digit runs by value ("P-E-9" before "P-E-10"). */
export function compareLabCodes(a: string, b: string): number {
  const pa = a.split(/(\d+)/)
  const pb = b.split(/(\d+)/)
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    if (pa[i] === pb[i]) continue
    if (i % 2 === 1) {
      const d = Number(pa[i]) - Number(pb[i])
      if (d !== 0) return d
    }
    return pa[i] < pb[i] ? -1 : 1
  }
  return pa.length - pb.length
}

function emptyReport(): LabCatalogReport {
  return {
    total: 0, bySubject: {}, byGroup: {}, scraped: [], unnamed: [], partialNames: [], filesWithoutIndexEntry: [], indexEntriesWithoutFile: [],
    duplicates: [], skippedFiles: [], emptyGroups: [], badLevels: [],
  }
}

export function buildLabCatalog(input: { index: ParsedLabIndex | null; files: LabFileInput[]; generatedAt: string }): { catalog: LabCatalog; report: LabCatalogReport } {
  const { index, generatedAt } = input
  const report = emptyReport()
  const subjectDefs = index && index.subjects.length > 0 ? index.subjects : DEFAULT_SUBJECTS
  const levelDefs = index && index.levels.length > 0 ? index.levels : DEFAULT_LEVELS
  const knownLevels = new Set(levelDefs.map((l) => l.id))
  const groupDefs = new Map<string, LabGroup>()
  for (const g of index?.groups ?? []) groupDefs.set(g.id, { id: g.id, subject: labSubjectOfGroup(g.id), ar: g.ar, en: g.en, fr: g.fr })
  const entries = new Map((index?.data ?? []).map((d) => [d.code, d]))

  // one file per code (first folder wins), unsafe names skipped
  const files = new Map<string, LabFileInput>()
  for (const f of input.files) {
    if (!LAB_CODE_RE.test(f.code)) { report.skippedFiles.push(f.code); continue }
    if (files.has(f.code)) { if (!report.duplicates.includes(f.code)) report.duplicates.push(f.code); continue }
    files.set(f.code, f)
  }
  for (const code of entries.keys()) if (!files.has(code)) report.indexEntriesWithoutFile.push(code)

  const experiments: LabExperiment[] = []
  const usedGroups = new Set<string>()
  const usedSubjects = new Set<string>()
  for (const code of [...files.keys()].sort(compareLabCodes)) {
    const entry = entries.get(code)
    let names: LabNames
    let group: string
    let subject: string
    let level: string | undefined
    if (entry) {
      const fallback = entry.en || entry.ar || entry.fr || code
      names = { ar: entry.ar || fallback, en: entry.en || fallback, fr: entry.fr || fallback }
      if (!entry.ar && !entry.en && !entry.fr) report.unnamed.push(code)
      else if (!entry.ar || !entry.en || !entry.fr) report.partialNames.push(code)
      group = entry.g
      subject = labSubjectOfGroup(group)
      if (entry.lv) {
        const kept = [...entry.lv].filter((c) => knownLevels.has(c)).join('')
        if (kept.length !== entry.lv.length) report.badLevels.push(code)
        level = kept || undefined
      }
    } else {
      report.filesWithoutIndexEntry.push(code)
      const found = scrapeLabNames(files.get(code)!.read(), code)
      if (found) report.scraped.push(code)
      else report.unnamed.push(code)
      names = found ?? { ar: code, en: code, fr: code }
      subject = labSubjectOfCode(code)
      group = code.toLowerCase().replace(/-\d+$/, '')
    }
    if (!groupDefs.has(group)) {
      const family = code.replace(/-\d+$/, '')
      groupDefs.set(group, { id: group, subject, ar: family, en: family, fr: family })
    }
    usedGroups.add(group)
    usedSubjects.add(subject)
    const exp: LabExperiment = { code, ...names, subject, group, kind: labKindOfSubject(subject) }
    if (level) exp.level = level
    experiments.push(exp)
    report.bySubject[subject] = (report.bySubject[subject] ?? 0) + 1
    report.byGroup[group] = (report.byGroup[group] ?? 0) + 1
  }

  const groups = [...groupDefs.values()].filter((g) => usedGroups.has(g.id))
  for (const g of groupDefs.values()) if (!usedGroups.has(g.id)) report.emptyGroups.push(g.id)
  const subjects = subjectDefs.filter((s) => usedSubjects.has(s.id))
  report.total = experiments.length
  report.scraped.sort(compareLabCodes)
  report.unnamed.sort(compareLabCodes)
  report.partialNames.sort(compareLabCodes)
  report.filesWithoutIndexEntry.sort(compareLabCodes)
  report.indexEntriesWithoutFile.sort(compareLabCodes)
  report.duplicates.sort(compareLabCodes)

  return {
    catalog: { version: 1, generated_at: generatedAt, count: experiments.length, subjects, groups, levels: levelDefs, experiments },
    report,
  }
}
