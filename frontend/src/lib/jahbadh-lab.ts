import type { LabCatalog, LabExperiment, LabLang } from '@/types'

/**
 * Jahbadh Lab: ~1,800 self-contained HTML experiments served as static files from the server
 * on https://lab.istudent.ly (NOT part of the repo; see docs/jahbadh/lab-hosting.md). Web only, not in the app. The catalog is `${LAB_BASE}/catalog.json`,
 * an experiment opens at `${LAB_BASE}/<CODE>.html?lang=<ar|en|fr>`.
 */
export const LAB_BASE = (process.env.NEXT_PUBLIC_LAB_BASE_URL || 'https://lab.istudent.ly').replace(/\/+$/, '')

export const LAB_LANGS: readonly LabLang[] = ['ar', 'en', 'fr']

// Same localStorage keys the labs themselves use, so favourites / recent / language are shared
// with the experiment pages when the files are served from this origin.
const FAVS_KEY = 'jlab-favs'
const RECENT_KEY = 'jlab-recent'
const LANG_KEY = 'jlab-lang'

const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** Codes go into URLs: only the file-name charset is accepted. */
export function isLabCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_RE.test(value)
}

export function isLabLang(value: unknown): value is LabLang {
  return value === 'ar' || value === 'en' || value === 'fr'
}

export function labExperimentUrl(code: string, lang: LabLang): string {
  return `${LAB_BASE}/${encodeURIComponent(code)}.html?lang=${lang}`
}

/** Site language to lab language (the lab has ar / en / fr). */
export function labLangFromLocale(locale: string): LabLang {
  const l = locale.slice(0, 2).toLowerCase()
  return isLabLang(l) ? l : 'en'
}

export function labName(e: Pick<LabExperiment, 'ar' | 'en' | 'fr'>, lang: LabLang): string {
  return e[lang] || e.en || e.ar || e.fr
}

/** Drops the "Subject · " prefix of a group label ("Physics · Electricity" becomes "Electricity"). */
export function labShortGroup(text: string): string {
  return text.includes(' · ') ? text.split(' · ').slice(1).join(' · ') : text
}

/** Search text: lower case, no accents, tashkeel or tatweel, one form of hamza / taa marbuta / alif maqsura, ASCII digits. */
export function normalizeLabText(input: string): string {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0))
}

// ---- catalog ---------------------------------------------------------------------------------------

/** The lab files (or their catalog) are not on this server. */
export class LabNotInstalledError extends Error {
  constructor() {
    super('Jahbadh Lab files are not installed on this server')
    this.name = 'LabNotInstalledError'
  }
}

function isCatalog(value: unknown): value is LabCatalog {
  const c = value as Partial<LabCatalog> | null
  return !!c && c.version === 1 && Array.isArray(c.experiments) && Array.isArray(c.subjects) && Array.isArray(c.groups) && Array.isArray(c.levels)
}

export async function fetchLabCatalog(): Promise<LabCatalog> {
  let res: Response
  try {
    res = await fetch(`${LAB_BASE}/catalog.json`, { cache: 'no-cache' })
  } catch {
    throw new Error('Could not reach the lab server')
  }
  if (res.status === 404) throw new LabNotInstalledError()
  if (!res.ok) throw new Error(`Lab catalog request failed (${res.status})`)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    // an HTML page instead of JSON means the static folder is not mounted at this path
    throw new LabNotInstalledError()
  }
  if (!isCatalog(body)) throw new LabNotInstalledError()
  return body
}

// ---- local storage (favourites, recent, language) -------------------------------------------------

function readList(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && CODE_RE.test(x)) : []
  } catch {
    return []
  }
}

function writeList(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // private mode / blocked storage: the lists just do not persist
  }
}

export const labFavourites = {
  list: () => readList(FAVS_KEY),
  /** Adds or removes the code; returns the new list. */
  toggle(code: string): string[] {
    const list = readList(FAVS_KEY)
    const i = list.indexOf(code)
    if (i >= 0) list.splice(i, 1)
    else list.unshift(code)
    writeList(FAVS_KEY, list)
    return list
  },
}

export const labRecent = {
  list: () => readList(RECENT_KEY),
  push(code: string): string[] {
    const list = [code, ...readList(RECENT_KEY).filter((c) => c !== code)].slice(0, 12)
    writeList(RECENT_KEY, list)
    return list
  },
  clear() {
    writeList(RECENT_KEY, [])
  },
}

export function readStoredLabLang(): LabLang | null {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return isLabLang(v) ? v : null
  } catch {
    return null
  }
}

export function storeLabLang(lang: LabLang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // ignore
  }
}

export const LAB_STORAGE_KEYS = [FAVS_KEY, RECENT_KEY, LANG_KEY]
