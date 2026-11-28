'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Activity, Box, Clock, FlaskConical, Lightbulb, Search, Star, Wrench, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLabCatalog } from '@/hooks/useLabCatalog'
import {
  LAB_LANGS, LAB_STORAGE_KEYS, labFavourites, labLangFromLocale, labName, labRecent, labShortGroup, normalizeLabText, readStoredLabLang,
  storeLabLang,
} from '@/lib/jahbadh-lab'
import type { LabCatalog as Catalog, LabExperiment, LabKind, LabLang } from '@/types'
import { LabLoadError, LabNotInstalled } from './LabStates'

export type LabRole = 'admin' | 'teacher' | 'student' | 'parent'

const PAGE = 48
const LANG_LABEL: Record<LabLang, string> = { ar: 'ع', en: 'EN', fr: 'FR' }
const KIND_ICON: Record<LabKind, typeof FlaskConical> = { experiment: FlaskConical, simulation: Activity, howto: Lightbulb, tool: Wrench, model: Box }

const chip = (active: boolean) =>
  cn(
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'border-indigo-600 bg-indigo-600 text-white'
      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
  )

interface CardProps {
  exp: LabExperiment
  lang: LabLang
  href: string
  groupLabel: string
  levelLabel: string
  favourite: boolean
  onToggleFavourite: (code: string) => void
  onOpen: (code: string) => void
  favLabel: string
}

function LabCard({ exp, lang, href, groupLabel, levelLabel, favourite, onToggleFavourite, onOpen, favLabel }: CardProps) {
  const Icon = KIND_ICON[exp.kind]
  return (
    <Link
      href={href}
      onClick={() => onOpen(exp.code)}
      className="group relative flex flex-col gap-1.5 rounded-xl border bg-white p-3 pe-10 shadow-sm transition hover:border-indigo-400 hover:shadow dark:border-gray-800 dark:bg-gray-900"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400" dir="ltr">
        <Icon className="size-3.5" aria-hidden /> {exp.code}
      </span>
      <span className="text-sm font-medium leading-snug text-gray-800 dark:text-gray-100">{labName(exp, lang)}</span>
      <span className="mt-auto flex flex-wrap gap-1 pt-1 text-[11px] text-gray-500 dark:text-gray-400">
        <span>{groupLabel}</span>
        {levelLabel && <span>· {levelLabel}</span>}
      </span>
      <button
        type="button"
        aria-pressed={favourite}
        aria-label={favLabel}
        title={favLabel}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavourite(exp.code)
        }}
        className="absolute end-2 top-2 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <Star className={cn('size-4', favourite && 'fill-amber-400 text-amber-500')} />
      </button>
    </Link>
  )
}

export default function LabCatalog({ role }: { role: LabRole }) {
  const t = useTranslations('jahbadhLab')
  const locale = useLocale()
  const { catalog, isLoading, notInstalled, error, retry } = useLabCatalog()

  const [lang, setLang] = useState<LabLang>(() => labLangFromLocale(locale))
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('all') // 'all' | 'fav' | subject id
  const [group, setGroup] = useState('all')
  const [level, setLevel] = useState('all')
  const [favs, setFavs] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [paging, setPaging] = useState({ key: '', n: PAGE })

  // favourites / recent / language live in localStorage (read after mount, shared with the labs and other tabs)
  useEffect(() => {
    const read = () => {
      setFavs(labFavourites.list())
      setRecent(labRecent.list())
    }
    read()
    const stored = readStoredLabLang()
    if (stored) setLang(stored)
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || LAB_STORAGE_KEYS.includes(e.key)) read()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const chooseLang = useCallback((l: LabLang) => {
    setLang(l)
    storeLabLang(l)
  }, [])
  const toggleFavourite = useCallback((code: string) => setFavs(labFavourites.toggle(code)), [])
  const markOpened = useCallback((code: string) => setRecent(labRecent.push(code)), [])

  const index = useMemo(() => {
    if (!catalog) return null
    const groupById = new Map(catalog.groups.map((g) => [g.id, g]))
    const haystack = new Map<string, string>()
    for (const e of catalog.experiments) {
      const g = groupById.get(e.group)
      haystack.set(e.code, normalizeLabText([e.code, e.ar, e.en, e.fr, g?.ar, g?.en, g?.fr].join(' ')))
    }
    const byCode = new Map(catalog.experiments.map((e) => [e.code, e]))
    return { groupById, haystack, byCode }
  }, [catalog])

  const words = useMemo(() => normalizeLabText(query).split(/\s+/).filter(Boolean), [query])
  const inLevel = useCallback((e: LabExperiment) => level === 'all' || !e.level || e.level.includes(level), [level])
  const matches = useCallback(
    (e: LabExperiment) => {
      if (!inLevel(e)) return false
      if (words.length === 0) return true
      const hay = index?.haystack.get(e.code) ?? ''
      return words.every((w) => hay.includes(w))
    },
    [inLevel, words, index],
  )

  const filtered = useMemo(() => {
    if (!catalog) return []
    const favSet = new Set(favs)
    return catalog.experiments.filter((e) => {
      if (subject === 'fav' ? !favSet.has(e.code) : subject !== 'all' && e.subject !== subject) return false
      if (group !== 'all' && e.group !== group) return false
      return matches(e)
    })
  }, [catalog, subject, group, favs, matches])

  const subjectCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of catalog?.experiments ?? []) m.set(e.subject, (m.get(e.subject) ?? 0) + 1)
    return m
  }, [catalog])
  const groupCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of catalog?.experiments ?? []) if (e.subject === subject) m.set(e.group, (m.get(e.group) ?? 0) + 1)
    return m
  }, [catalog, subject])

  const filterKey = `${subject}|${group}|${level}|${words.join(' ')}`
  const shown = paging.key === filterKey ? paging.n : PAGE
  const resetFilters = () => {
    setQuery('')
    setSubject('all')
    setGroup('all')
    setLevel('all')
  }

  const cardFor = (e: LabExperiment, cat: Catalog) => {
    const g = index?.groupById.get(e.group)
    const levelLabel = e.level
      ? [...e.level].map((id) => cat.levels.find((l) => l.id === id)?.[lang]).filter(Boolean).join(' · ')
      : ''
    return (
      <LabCard
        key={e.code}
        exp={e}
        lang={lang}
        href={`/${role}/resources/jahbadh-lab/${encodeURIComponent(e.code)}`}
        groupLabel={g ? labShortGroup(g[lang] || g.en) : ''}
        levelLabel={levelLabel}
        favourite={favs.includes(e.code)}
        onToggleFavourite={toggleFavourite}
        onOpen={markOpened}
        favLabel={favs.includes(e.code) ? t('removeFavourite') : t('addFavourite')}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }
  if (notInstalled) return <LabNotInstalled isAdmin={role === 'admin'} />
  if (error || !catalog || !index) return <LabLoadError onRetry={retry} />

  const showShelves = subject === 'all' && group === 'all' && words.length === 0 && level === 'all'
  const favExps = favs.map((c) => index.byCode.get(c)).filter((e): e is LabExperiment => !!e)
  const recentExps = recent.map((c) => index.byCode.get(c)).filter((e): e is LabExperiment => !!e).slice(0, 8)
  const groupsOfSubject = catalog.groups.filter((g) => g.subject === subject && groupCounts.has(g.id))
  const stageRange: Record<string, string> = { p: t('rangePrimary'), m: t('rangeMiddle'), s: t('rangeSecondary') }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <FlaskConical className="size-5 text-indigo-600" aria-hidden /> {t('title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('subtitle', { count: catalog.count })}</p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
          {LAB_LANGS.map((l) => (
            <Button key={l} type="button" size="sm" variant={l === lang ? 'default' : 'outline'} onClick={() => chooseLang(l)} aria-pressed={l === lang}>
              {LANG_LABEL[l]}
            </Button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="ps-9 pe-9" aria-label={t('searchPlaceholder')} />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label={t('clearSearch')} className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Subjects */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(subject === 'all')} onClick={() => { setSubject('all'); setGroup('all') }}>
          {t('all')} · {catalog.count}
        </button>
        <button type="button" className={chip(subject === 'fav')} onClick={() => { setSubject('fav'); setGroup('all') }}>
          ★ {t('favourites')} · {favExps.length}
        </button>
        {catalog.subjects.map((s) => (
          <button key={s.id} type="button" className={chip(subject === s.id)} onClick={() => { setSubject(s.id); setGroup('all') }}>
            {s[lang] || s.en} · {subjectCounts.get(s.id) ?? 0}
          </button>
        ))}
      </div>

      {/* Groups of the chosen subject */}
      {groupsOfSubject.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {groupsOfSubject.map((g) => (
            <button key={g.id} type="button" className={chip(group === g.id)} onClick={() => setGroup(group === g.id ? 'all' : g.id)}>
              {labShortGroup(g[lang] || g.en)} · {groupCounts.get(g.id)}
            </button>
          ))}
        </div>
      )}

      {/* Stage */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">{t('stage')}</span>
        <button type="button" className={chip(level === 'all')} onClick={() => setLevel('all')}>
          {t('allStages')}
        </button>
        {catalog.levels.map((l) => (
          <button key={l.id} type="button" className={chip(level === l.id)} onClick={() => setLevel(level === l.id ? 'all' : l.id)}>
            {l[lang] || l.en} {stageRange[l.id] ? `(${stageRange[l.id]})` : ''}
          </button>
        ))}
      </div>

      {/* Favourites + recent shelves */}
      {showShelves && favExps.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
            <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden /> {t('myFavourites')} <span className="font-normal text-gray-400">{favExps.length}</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{favExps.slice(0, 8).map((e) => cardFor(e, catalog))}</div>
        </section>
      )}
      {showShelves && recentExps.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <Clock className="size-4" aria-hidden /> {t('recent')}
            </h2>
            <button type="button" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400" onClick={() => { labRecent.clear(); setRecent([]) }}>
              {t('clearRecent')}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{recentExps.map((e) => cardFor(e, catalog))}</div>
        </section>
      )}

      {/* Results */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{t('resultsCount', { count: filtered.length })}</Badge>
        {(query || subject !== 'all' || group !== 'all' || level !== 'all') && (
          <button type="button" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400" onClick={resetFilters}>
            {t('resetFilters')}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {subject === 'fav' && favExps.length === 0 ? t('emptyFavourites') : t('noResults')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{filtered.slice(0, shown).map((e) => cardFor(e, catalog))}</div>
          {filtered.length > shown && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setPaging({ key: filterKey, n: shown + PAGE })}>
                {t('showMore', { count: filtered.length - shown })}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
