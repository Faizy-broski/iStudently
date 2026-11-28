/** Pure model + filtering for the Jahbadh Lab catalog (no React, no env: unit-tested). */

export type LabLang = 'ar' | 'en' | 'fr'
export const LAB_LANGS: LabLang[] = ['ar', 'en', 'fr']

export type LabKind = 'experiment' | 'simulation' | 'howto' | 'tool' | 'model'

type Names = { ar?: string; en?: string; fr?: string }
export type LabSubject = Names & { id: string }
export type LabGroup = Names & { id: string; subject: string }
export type LabLevel = Names & { id: string }
export type LabExperiment = Names & { code: string; subject?: string; group?: string; level?: string; kind?: LabKind | string }

export type LabCatalog = {
  version: number
  generated_at?: string
  count?: number
  subjects: LabSubject[]
  groups: LabGroup[]
  levels: LabLevel[]
  experiments: LabExperiment[]
}

/** An experiment code as it appears in file names (P-E-001, SIM-163, TOOL-001): safe to put in a URL path. */
export const LAB_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/

/** The name in the chosen language, falling back to English, Arabic, French, then `fallback`. */
export function labName(n: Names | undefined, lang: LabLang, fallback = ''): string {
  if (!n) return fallback
  return n[lang] || n.en || n.ar || n.fr || fallback
}

/** Validates a downloaded catalog.json: anything else (an HTML page, a partial file) is "not installed". */
export function parseCatalog(raw: unknown): LabCatalog | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.experiments)) return null
  const experiments = (r.experiments as unknown[]).filter(
    (e): e is LabExperiment => !!e && typeof e === 'object' && typeof (e as LabExperiment).code === 'string' && LAB_CODE_RE.test((e as LabExperiment).code),
  )
  const list = <T extends { id: string }>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]).filter((x) => x && typeof x.id === 'string') : [])
  return {
    version: typeof r.version === 'number' ? r.version : 1,
    generated_at: typeof r.generated_at === 'string' ? r.generated_at : undefined,
    count: typeof r.count === 'number' ? r.count : experiments.length,
    subjects: list<LabSubject>(r.subjects),
    groups: list<LabGroup>(r.groups),
    levels: list<LabLevel>(r.levels),
    experiments,
  }
}

const TASHKEEL = /[ً-ٰٟـ]/g

/** Lower-case, no Arabic diacritics/tatweel, unified alef/ya/ta-marbuta, Latin accents removed: for search. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(TASHKEEL, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
}

/** One searchable string per experiment (code + every language), built once per catalog. */
export function buildHaystacks(experiments: LabExperiment[]): string[] {
  return experiments.map((e) => normalizeSearch([e.code, e.ar, e.en, e.fr].filter(Boolean).join(' ')))
}

export type LabFilter = {
  query: string
  subject: string | null
  group: string | null
  level: string | null
  favouritesOnly: boolean
}

export const EMPTY_FILTER: LabFilter = { query: '', subject: null, group: null, level: null, favouritesOnly: false }

/** Experiments matching every active filter (all words of the query must appear). Keeps catalog order. */
export function filterExperiments(experiments: LabExperiment[], haystacks: string[], f: LabFilter, favourites: ReadonlySet<string>): LabExperiment[] {
  const words = normalizeSearch(f.query).split(/\s+/).filter(Boolean)
  const out: LabExperiment[] = []
  for (let i = 0; i < experiments.length; i++) {
    const e = experiments[i]
    if (f.subject && e.subject !== f.subject) continue
    if (f.group && e.group !== f.group) continue
    if (f.level && e.level !== f.level) continue
    if (f.favouritesOnly && !favourites.has(e.code)) continue
    if (words.length) {
      const hay = haystacks[i] ?? ''
      if (!words.every((w) => hay.includes(w))) continue
    }
    out.push(e)
  }
  return out
}

/** How many experiments each subject has (for the chips). */
export function countBy(experiments: LabExperiment[], key: 'subject' | 'group' | 'level'): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of experiments) {
    const v = e[key]
    if (v) m.set(v, (m.get(v) ?? 0) + 1)
  }
  return m
}

/** Parses a stored JSON list of codes (favourites / recent), dropping anything that isn't a valid code. */
export function parseCodeList(raw: string | null | undefined, max = 500): string[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v.filter((x): x is string => typeof x === 'string' && LAB_CODE_RE.test(x)).slice(0, max)
  } catch {
    return []
  }
}

/** Puts `code` first in a recent list (no duplicates, capped). */
export function pushRecent(list: string[], code: string, max = 12): string[] {
  return [code, ...list.filter((c) => c !== code)].slice(0, max)
}

/** True when `url` is inside the lab folder (same origin, path under `base`'s path) or about:blank. */
export function isInsideLab(url: string, base: string): boolean {
  if (url === 'about:blank') return true
  try {
    const u = new URL(url)
    const b = new URL(base.endsWith('/') ? base : `${base}/`)
    return u.origin === b.origin && u.pathname.startsWith(b.pathname)
  } catch {
    return false
  }
}

/** True when `url` is the lab's launcher page (index.html), which the app replaces with its own catalog. */
export function isLabHome(url: string, base: string): boolean {
  try {
    const u = new URL(url)
    const b = new URL(base.endsWith('/') ? base : `${base}/`)
    if (u.origin !== b.origin || !u.pathname.startsWith(b.pathname)) return false
    const rest = u.pathname.slice(b.pathname.length)
    return rest === '' || rest === 'index.html'
  } catch {
    return false
  }
}

/** The file URL of one experiment. */
export function experimentUrl(base: string, code: string, lang: LabLang): string {
  return `${base.replace(/\/$/, '')}/${code}.html?lang=${lang}`
}
