'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ExternalLink, FlaskConical, Loader2, Maximize2, Minimize2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useLabCatalog } from '@/hooks/useLabCatalog'
import {
  LAB_LANGS, isLabCode, isLabLang, labExperimentUrl, labFavourites, labLangFromLocale, labName, labRecent, readStoredLabLang, storeLabLang,
} from '@/lib/jahbadh-lab'
import type { LabLang } from '@/types'
import type { LabRole } from './LabCatalog'
import { LabLoadError, LabNotInstalled } from './LabStates'

const LANG_LABEL: Record<LabLang, string> = { ar: 'ع', en: 'EN', fr: 'FR' }

// The labs are first-party static pages that need scripts, their own localStorage and downloads.
// No `allow-top-navigation`: a lab can never navigate the portal away.
const SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals'

export default function LabPlayer({ role, code }: { role: LabRole; code: string }) {
  const t = useTranslations('jahbadhLab')
  const locale = useLocale()
  const { catalog, isLoading, notInstalled, error, retry } = useLabCatalog()
  const backHref = `/${role}/resources/jahbadh-lab`

  // frameLang decides the iframe address (changing it reloads the lab); lang follows the lab's own switch
  const [frameLang, setFrameLang] = useState<LabLang>(() => labLangFromLocale(locale))
  const [lang, setLang] = useState<LabLang>(frameLang)
  const [loaded, setLoaded] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [favourite, setFavourite] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const valid = isLabCode(code)

  useEffect(() => {
    const stored = readStoredLabLang()
    if (stored) {
      setFrameLang(stored)
      setLang(stored)
    }
    if (valid) {
      setFavourite(labFavourites.list().includes(code))
      labRecent.push(code)
    }
  }, [code, valid])

  // The lab announces its language switch; nothing else it posts is read or stored.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return
      const d = e.data as { source?: unknown; event?: unknown; lang?: unknown } | null
      if (d && d.source === 'jahbadh-lab' && d.event === 'lang' && isLabLang(d.lang)) setLang(d.lang)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void boxRef.current?.requestFullscreen?.()
  }, [])

  const chooseLang = (l: LabLang) => {
    if (l === frameLang) return
    storeLabLang(l)
    setLoaded(false)
    setFrameLang(l)
    setLang(l)
  }

  if (!valid) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('experimentNotFound')}</p>
        <Button asChild variant="outline"><Link href={backHref}>{t('backToCatalog')}</Link></Button>
      </div>
    )
  }
  if (isLoading) return <Skeleton className="h-[60vh] w-full rounded-xl" />
  if (notInstalled) return <LabNotInstalled isAdmin={role === 'admin'} />
  if (error || !catalog) return <LabLoadError onRetry={retry} />

  const exp = catalog.experiments.find((e) => e.code === code)
  if (!exp) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('experimentNotFound')}</p>
        <Button asChild variant="outline"><Link href={backHref}>{t('backToCatalog')}</Link></Button>
      </div>
    )
  }

  const title = labName(exp, lang)
  const src = labExperimentUrl(code, frameLang)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-gray-500 dark:text-gray-400">
          <Link href={backHref}><ArrowLeft className="size-4 rtl:rotate-180" /> {t('back')}</Link>
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FlaskConical className="size-4 shrink-0 text-indigo-600" aria-hidden />
          <span className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</span>
          <span className="shrink-0 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400" dir="ltr">{code}</span>
        </div>
        <button
          type="button"
          aria-pressed={favourite}
          aria-label={favourite ? t('removeFavourite') : t('addFavourite')}
          title={favourite ? t('removeFavourite') : t('addFavourite')}
          onClick={() => setFavourite(labFavourites.toggle(code).includes(code))}
          className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Star className={cn('size-4', favourite && 'fill-amber-400 text-amber-500')} />
        </button>
        <div className="flex items-center gap-1" role="group" aria-label={t('language')}>
          {LAB_LANGS.map((l) => (
            <Button key={l} type="button" size="sm" variant={l === frameLang ? 'default' : 'outline'} onClick={() => chooseLang(l)} aria-pressed={l === frameLang}>
              {LANG_LABEL[l]}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1">
          {fullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          {fullscreen ? t('exitFullscreen') : t('fullscreen')}
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1">
          <a href={labExperimentUrl(code, lang)} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" /> {t('openInNewTab')}
          </a>
        </Button>
      </div>

      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-xl border bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
        style={{ height: fullscreen ? '100vh' : 'calc(100vh - 210px)', minHeight: 520 }}
      >
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="size-5 animate-spin" aria-hidden /> {t('loadingExperiment')}
          </div>
        )}
        <iframe
          key={src}
          ref={frameRef}
          src={src}
          title={title}
          className="h-full w-full border-0"
          allow="fullscreen"
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
