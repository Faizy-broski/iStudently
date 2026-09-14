'use client'

/**
 * Client container for the module. Never computes anything that gets
 * stored: every write sends "what the user did" and receives back
 * server-computed state. Derivations here (search/filter, which card looks
 * due) are display-only and reuse the same pure engine the server uses.
 */
import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookOpen, CalendarClock, Flame, Repeat, Star } from 'lucide-react'
import { getAuthToken } from '@/lib/api/schools'
import { useCampus } from '@/context/CampusContext'
import { getState, getContent, type HadithProgress, type ModuleState, type HadithCategory } from '@/lib/api/hadith-forty'
import { HadithSheet } from './HadithSheet'
import { ActivityBars } from './ActivityBars'

type Filter = 'all' | 'due' | 'learning' | 'mastered' | 'favorites'

function emptyProgress(hadithNumber: number): HadithProgress {
  return { hadithNumber, repetitions: 0, state: 'new', box: 0, dueOn: null, lastReviewedOn: null, isFavorite: false, note: '' }
}

function isDue(p: Pick<HadithProgress, 'dueOn'>, today: string): boolean {
  return p.dueOn !== null && p.dueOn <= today
}

/** Arabic-aware search normalisation: strips diacritics/tatweel, normalises alif/ya/ta marbuta variants. */
function normalise(value: string): string {
  return value
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

const makeStateFetcher = (campusId?: string) => async (): Promise<ModuleState | null> => {
  const token = await getAuthToken()
  if (!token) return null
  const res = await getState(token, campusId)
  return res.success && res.data ? res.data : null
}

const makeContentFetcher = (campusId?: string) => async () => {
  const token = await getAuthToken()
  if (!token) return null
  const res = await getContent(token, campusId)
  return res.success && res.data ? res.data : null
}

export function HadithFortyApp() {
  const t = useTranslations('hadithForty')
  const campusId = useCampus()?.selectedCampus?.id
  const { data: state, error, isLoading, mutate } = useSWR<ModuleState | null>(
    ['hadith-forty-state', campusId],
    makeStateFetcher(campusId),
    { revalidateOnFocus: false }
  )
  const { data: content } = useSWR(['hadith-forty-content', campusId], makeContentFetcher(campusId), { revalidateOnFocus: false })

  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState<HadithCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [openNumber, setOpenNumber] = useState<number | null>(null)
  const [session, setSession] = useState<readonly number[] | null>(null)

  const progressByNumber = useMemo(() => {
    const map = new Map<number, HadithProgress>()
    for (const p of state?.progress ?? []) map.set(p.hadithNumber, p)
    return map
  }, [state?.progress])

  const progressOf = (n: number): HadithProgress => progressByNumber.get(n) ?? emptyProgress(n)

  const hadiths = content?.hadiths ?? []

  const visible = useMemo(() => {
    if (!state) return []
    const needle = query.trim() ? normalise(query.trim()) : ''
    return hadiths.filter((h) => {
      const p = progressOf(h.number)
      if (filter === 'due' && !isDue(p, state.today)) return false
      if (filter === 'learning' && p.state !== 'learning') return false
      if (filter === 'mastered' && p.state !== 'mastered') return false
      if (filter === 'favorites' && !p.isFavorite) return false
      if (category !== 'all' && h.category !== category) return false
      if (needle && !normalise(`${h.title} ${h.text} ${h.source}`).includes(needle)) return false
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, category, query, progressByNumber, state?.today, hadiths])

  if ((isLoading && !state) || !content) return <LoadingSkeleton label={t('loading')} />
  if ((error || !state) && !isLoading) {
    return (
      <Card>
        <CardContent className="text-destructive p-6 text-sm">{t('error.load')}</CardContent>
      </Card>
    )
  }
  if (!state) return <LoadingSkeleton label={t('loading')} />

  const headline =
    state.stats.mastered === state.stats.total
      ? t('stats.completed')
      : state.streak > 1
        ? t('stats.streak', { days: state.streak })
        : state.stats.mastered === 0 && state.stats.totalRepetitions === 0
          ? t('stats.notStarted')
          : t('stats.keepGoing')

  const startSession = () => {
    if (state.session.length === 0) return
    setSession(state.session)
    setOpenNumber(state.session[0] ?? null)
  }

  const advanceSession = (): boolean => {
    if (!session || openNumber === null) return false
    const index = session.indexOf(openNumber)
    const next = session[index + 1]
    if (next === undefined) {
      setSession(null)
      setOpenNumber(null)
      return false
    }
    setOpenNumber(next)
    return true
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-muted-foreground text-sm">{headline}</p>
              <p className="mt-1 text-3xl font-extrabold">{state.stats.masteryPercent}%</p>
              <p className="text-muted-foreground text-xs">{t('stats.mastery')}</p>
            </div>
            <Progress value={state.stats.masteryPercent} aria-label={t('stats.mastery')} />
            <p className="text-muted-foreground text-sm">
              {t('stats.masteredOf', { mastered: state.stats.mastered, total: state.stats.total })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={startSession} disabled={state.session.length === 0}>
                <CalendarClock className="size-4" aria-hidden />
                {t('actions.startSession')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const next = hadiths.find((h) => isDue(progressOf(h.number), state.today)) ?? hadiths.find((h) => progressOf(h.number).state !== 'mastered') ?? hadiths[0]
                  if (next) setOpenNumber(next.number)
                }}
              >
                <BookOpen className="size-4" aria-hidden />
                {t('actions.resume')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <ActivityBars activity={state.activity} settings={state.settings} campusId={campusId} onSettingsSaved={() => void mutate()} />
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={<BookOpen className="size-4" aria-hidden />} value={state.stats.mastered} label={t('stats.mastered')} />
        <StatTile icon={<Flame className="size-4" aria-hidden />} value={state.stats.learning} label={t('stats.learning')} />
        <StatTile icon={<Repeat className="size-4" aria-hidden />} value={state.stats.totalRepetitions} label={t('stats.repetitions')} />
        <StatTile icon={<CalendarClock className="size-4" aria-hidden />} value={state.stats.dueToday} label={t('stats.dueToday')} highlight />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('filters.search')} className="max-w-xs" type="search" />
        <Select value={category} onValueChange={(value) => setCategory(value as HadithCategory | 'all')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('filters.allCategories')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {(content?.categories ?? []).map((c) => (
              <SelectItem key={c} value={c}>
                {t(`categories.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(['all', 'due', 'learning', 'mastered', 'favorites'] as const).map((key) => (
          <Button key={key} size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => setFilter(key)} aria-pressed={filter === key}>
            {t(`filters.${key}`)}
          </Button>
        ))}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.length === 0 ? (
          <p className="text-muted-foreground col-span-full py-8 text-sm">{t('filters.empty')}</p>
        ) : (
          visible.map((hadith) => {
            const p = progressOf(hadith.number)
            return (
              <button
                key={hadith.number}
                type="button"
                onClick={() => setOpenNumber(hadith.number)}
                className="bg-card hover:border-primary focus-visible:ring-ring flex items-start gap-3 rounded-xl border p-4 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  className={[
                    'grid size-11 shrink-0 place-items-center rounded-lg text-base font-extrabold',
                    p.state === 'mastered' ? 'bg-primary text-primary-foreground' : p.state === 'learning' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {hadith.number}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {hadith.title}
                    {p.isFavorite ? <Star className="text-primary size-3.5 shrink-0" aria-hidden /> : null}
                  </span>
                  <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span>{t('card.repetitionCount', { count: p.repetitions })}</span>
                    {isDue(p, state.today) ? <span className="text-primary font-semibold">{t('card.dueBadge')}</span> : null}
                    <span>{t(`card.state.${p.state}`)}</span>
                  </span>
                </span>
              </button>
            )
          })
        )}
      </section>

      <HadithSheet
        hadithNumber={openNumber}
        today={state.today}
        progressOf={progressOf}
        session={session}
        campusId={campusId}
        onOpenChange={(open) => {
          if (!open) {
            setOpenNumber(null)
            setSession(null)
          }
        }}
        onNavigate={setOpenNumber}
        onAdvanceSession={advanceSession}
        onChanged={() => void mutate()}
      />
    </div>
  )
}

function StatTile({ icon, value, label, highlight = false }: { icon: React.ReactNode; value: number; label: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-primary/40' : undefined}>
      <CardContent className="p-4">
        <div className={highlight ? 'text-primary' : 'text-muted-foreground'}>{icon}</div>
        <p className="mt-1 text-2xl font-extrabold">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </CardContent>
    </Card>
  )
}

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={label}>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  )
}
