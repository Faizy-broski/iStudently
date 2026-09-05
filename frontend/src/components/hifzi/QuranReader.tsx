'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'
import { getEditions, getSurahs, resolveRange, getAyahsInRange, type QuranSurah, type AyahWithText } from '@/lib/api/quran'
import { RecitationPane } from '@/components/hifzi/RecitationPane'
import { toast } from 'sonner'

const RIWAYAH_CODE = 'hafs' // only riwayah seeded so far — see backend/scripts/quran-seed

/**
 * Read-only browser for the 114 surahs (Phase 1: no audio, tafsir, translation
 * or search — see plan). Shared across student/teacher/parent hifzi routes.
 * Reuses RecitationPane in readOnly mode rather than duplicating word-split
 * rendering, so the Tanzil attribution line lives in exactly one place.
 */
export function QuranReader() {
    const t = useTranslations('hifzi.quranReader')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const [surahs, setSurahs] = useState<QuranSurah[]>([])
    const [textVerified, setTextVerified] = useState<boolean | null>(null) // null = not yet known
    const [selectedSurah, setSelectedSurah] = useState(1)
    const [ayahs, setAyahs] = useState<AyahWithText[]>([])
    const [loadingList, setLoadingList] = useState(true)
    const [loadingText, setLoadingText] = useState(false)
    const [notVerified, setNotVerified] = useState(false)

    useEffect(() => {
        Promise.all([getSurahs(RIWAYAH_CODE), getEditions(RIWAYAH_CODE)]).then(([surahsRes, editionsRes]) => {
            if (surahsRes.success && surahsRes.data) setSurahs(surahsRes.data)
            else toast.error(surahsRes.error || t('loadError'))
            if (editionsRes.success && editionsRes.data) {
                setTextVerified(editionsRes.data.some((e) => !!e.verified_at))
            }
            setLoadingList(false)
        })
    }, [])

    useEffect(() => {
        if (surahs.length === 0 || textVerified === false) return
        let cancelled = false
        setLoadingText(true)
        setNotVerified(false)
        ;(async () => {
            const rangeRes = await resolveRange({ riwayah: RIWAYAH_CODE, unitType: 'surah', number: selectedSurah })
            if (cancelled) return
            if (!rangeRes.success || !rangeRes.data) {
                if (rangeRes.error?.includes('not been signed off')) setNotVerified(true)
                else toast.error(rangeRes.error || t('loadError'))
                setAyahs([])
                setLoadingText(false)
                return
            }
            const textRes = await getAyahsInRange(RIWAYAH_CODE, rangeRes.data.startAyahId, rangeRes.data.endAyahId)
            if (cancelled) return
            if (!textRes.success || !textRes.data) {
                if (textRes.error?.includes('not been signed off')) setNotVerified(true)
                else toast.error(textRes.error || t('loadError'))
                setAyahs([])
            } else {
                setAyahs(textRes.data)
            }
            setLoadingText(false)
        })()
        return () => { cancelled = true }
    }, [selectedSurah, surahs.length, textVerified]) // eslint-disable-line react-hooks/exhaustive-deps

    const currentSurah = useMemo(() => surahs.find((s) => s.number === selectedSurah), [surahs, selectedSurah])
    const showNotVerifiedBanner = notVerified || textVerified === false

    if (loadingList) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
            </div>
        )
    }

    return (
        <div className="space-y-4 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
                    <BookOpen className="h-6 w-6 text-[#022172]" />
                    {t('title')}
                </h1>
                <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
            </div>

            <Card>
                <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <Button
                        variant="outline" size="icon"
                        onClick={() => setSelectedSurah((n) => Math.max(1, n - 1))}
                        disabled={selectedSurah <= 1}
                        aria-label={t('previousSurah')}
                    >
                        {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </Button>

                    <select
                        value={selectedSurah}
                        onChange={(e) => setSelectedSurah(Number(e.target.value))}
                        className="h-9 rounded-md border px-2 text-sm flex-1 min-w-[200px]"
                    >
                        {surahs.map((s) => (
                            <option key={s.number} value={s.number}>
                                {s.number}. {isAr ? s.nameAr : `${s.nameTransliterated} (${s.nameEn})`}
                            </option>
                        ))}
                    </select>

                    <Button
                        variant="outline" size="icon"
                        onClick={() => setSelectedSurah((n) => Math.min(114, n + 1))}
                        disabled={selectedSurah >= 114}
                        aria-label={t('nextSurah')}
                    >
                        {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>

                    {currentSurah && (
                        <>
                            <Badge variant="secondary">
                                {currentSurah.revelationPlace === 'meccan' ? t('meccan') : t('medinan')}
                            </Badge>
                            <Badge variant="secondary">{t('ayahCount', { count: currentSurah.ayahCount })}</Badge>
                        </>
                    )}
                </CardContent>
            </Card>

            {loadingText ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
                </div>
            ) : showNotVerifiedBanner ? (
                <Card className="border-dashed">
                    <CardContent className="p-8 text-center space-y-2">
                        <p className="font-medium">{t('notVerifiedTitle')}</p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('notVerifiedBody')}</p>
                    </CardContent>
                </Card>
            ) : (
                <RecitationPane
                    readOnly
                    ayahs={ayahs}
                    marks={new Map()}
                    activePickerKey={null}
                    onWordTap={() => {}}
                    onSelectType={() => {}}
                />
            )}
        </div>
    )
}
