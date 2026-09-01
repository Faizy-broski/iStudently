'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, Undo2, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getEnrollments, getHifziSettings, createSession, type HifziEnrollment, type HifziSettings } from '@/lib/api/hifzi'
import { getRiwayat, resolveRange, getAyahsInRange, type QuranRiwayah, type AyahWithText } from '@/lib/api/quran'
import { RecitationPane, wordKey, type WordMark } from '@/components/hifzi/RecitationPane'
import { SessionTimer } from '@/components/hifzi/SessionTimer'
import type { ErrorType } from '@/components/hifzi/ErrorTypePicker'
import { toast } from 'sonner'

const SESSION_TYPES = ['new', 'near_review', 'far_review', 'consolidation', 'continuous', 'tajweed', 'exam'] as const

// Client-side score preview only — mirrors backend/src/services/hifzi/grading-engine.service.ts's
// computeRawScore() formula exactly for immediate visual feedback (spec HFZ-REC-3: "auto-computed
// score shown before save"); the backend recomputes authoritatively on save using the school's
// actual configured weights, this is never trusted as the final score.
function previewScore(marks: WordMark[], weights: Record<string, number>): number {
    const counts: Record<string, number> = {}
    for (const m of marks) counts[m.errorType] = (counts[m.errorType] ?? 0) + 1
    const penalty = Object.entries(counts).reduce((sum, [type, count]) => sum + count * (weights[type] ?? 0), 0)
    return Math.min(10, Math.max(0, 10 - penalty))
}

export default function RecitePage() {
    const t = useTranslations('hifzi.recitation')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const params = useParams<{ circleId: string }>()
    const circleId = params.circleId

    const [roster, setRoster] = useState<HifziEnrollment[]>([])
    const [settings, setSettings] = useState<HifziSettings | null>(null)
    const [riwayat, setRiwayat] = useState<QuranRiwayah[]>([])
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Range picker (kept deliberately simple for Phase 1 — surah + ayah start/end, single riwayah)
    const [riwayahCode, setRiwayahCode] = useState('hafs')
    const [surahNumber, setSurahNumber] = useState('1')
    const [startAyah, setStartAyah] = useState('1')
    const [endAyah, setEndAyah] = useState('7')
    const [sessionType, setSessionType] = useState<(typeof SESSION_TYPES)[number]>('near_review')

    const [ayahs, setAyahs] = useState<AyahWithText[]>([])
    const [ayahRange, setAyahRange] = useState<{ startAyahId: string; endAyahId: string } | null>(null)
    const [loadingText, setLoadingText] = useState(false)

    const [marks, setMarks] = useState<Map<string, WordMark>>(new Map())
    const [markOrder, setMarkOrder] = useState<string[]>([])
    const [activePickerKey, setActivePickerKey] = useState<string | null>(null)
    const [sessionStartedAt, setSessionStartedAt] = useState(Date.now())
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
    const [overrideEnabled, setOverrideEnabled] = useState(false)
    const [overrideScore, setOverrideScore] = useState('')
    const [overrideReason, setOverrideReason] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        Promise.all([getEnrollments(circleId), getHifziSettings(), getRiwayat()]).then(([enrollRes, settingsRes, riwayatRes]) => {
            if (enrollRes.success && enrollRes.data) {
                setRoster(enrollRes.data)
                if (enrollRes.data.length > 0) setSelectedStudentId(enrollRes.data[0].student_id)
            } else if (!enrollRes.success) {
                toast.error(`Failed to load roster: ${enrollRes.error || 'unknown error'}`)
            }
            if (settingsRes.success && settingsRes.data) setSettings(settingsRes.data)
            else if (!settingsRes.success) toast.error(`Failed to load settings: ${settingsRes.error || 'unknown error'}`)
            if (riwayatRes.success && riwayatRes.data) setRiwayat(riwayatRes.data)
            else if (!riwayatRes.success) toast.error(`Failed to load riwayat: ${riwayatRes.error || 'unknown error'}`)
            setLoading(false)
        })
    }, [circleId])

    const resetMarks = () => {
        setMarks(new Map())
        setMarkOrder([])
        setActivePickerKey(null)
        setOverrideEnabled(false)
        setOverrideScore('')
        setOverrideReason('')
        setIdempotencyKey(crypto.randomUUID())
        setSessionStartedAt(Date.now())
    }

    const handleLoadText = async () => {
        setLoadingText(true)
        setAyahs([])
        setAyahRange(null)
        resetMarks()
        try {
            const rangeRes = await resolveRange({
                riwayah: riwayahCode,
                unitType: 'custom',
                startSurah: Number(surahNumber),
                startAyah: Number(startAyah),
                endSurah: Number(surahNumber),
                endAyah: Number(endAyah),
            })
            if (!rangeRes.success || !rangeRes.data) {
                toast.error(rangeRes.error || 'Failed to resolve range')
                return
            }
            const textRes = await getAyahsInRange(riwayahCode, rangeRes.data.startAyahId, rangeRes.data.endAyahId)
            if (!textRes.success || !textRes.data) {
                toast.error(textRes.error || 'Failed to load ayah text')
                return
            }
            setAyahs(textRes.data)
            setAyahRange({ startAyahId: rangeRes.data.startAyahId, endAyahId: rangeRes.data.endAyahId })
        } finally {
            setLoadingText(false)
        }
    }

    const handleWordTap = (ayahId: string, wordIndex: number) => {
        const key = wordKey(ayahId, wordIndex)
        // Tapping an already-marked word re-opens the picker to reclassify it — no confirmation, no separate "edit" mode.
        setActivePickerKey(key)
    }

    const handleSelectType = (ayahId: string, wordIndex: number, type: ErrorType) => {
        const key = wordKey(ayahId, wordIndex)
        setMarks((prev) => {
            const next = new Map(prev)
            next.set(key, { ayahId, wordIndex, errorType: type })
            return next
        })
        setMarkOrder((prev) => (prev.includes(key) ? prev : [...prev, key]))
        setActivePickerKey(null)
    }

    const handleUndo = () => {
        setMarkOrder((prev) => {
            if (prev.length === 0) return prev
            const lastKey = prev[prev.length - 1]
            setMarks((m) => {
                const next = new Map(m)
                next.delete(lastKey)
                return next
            })
            return prev.slice(0, -1)
        })
    }

    const marksList = useMemo(() => [...marks.values()], [marks])
    const preview = settings ? previewScore(marksList, settings.gradingWeights) : null

    const handleSave = async () => {
        if (!selectedStudentId || !ayahRange) return
        if (overrideEnabled && !overrideReason.trim()) {
            toast.error(t('overrideReason'))
            return
        }
        setSaving(true)
        try {
            const res = await createSession({
                student_id: selectedStudentId,
                circle_id: circleId,
                session_type: sessionType,
                start_ayah_id: ayahRange.startAyahId,
                end_ayah_id: ayahRange.endAyahId,
                errors: marksList.map((m) => ({ ayah_id: m.ayahId, word_index: m.wordIndex, error_type: m.errorType })),
                final_score: overrideEnabled ? Number(overrideScore) : null,
                override_reason: overrideEnabled ? overrideReason : null,
                client_uuid: idempotencyKey,
            })
            if (res.success) {
                toast.success(t('saved'))
                handleNextStudent()
            } else {
                toast.error(res.error || 'Failed to save')
            }
        } finally {
            setSaving(false)
        }
    }

    const handleNextStudent = () => {
        const currentIndex = roster.findIndex((e) => e.student_id === selectedStudentId)
        const next = roster[currentIndex + 1]
        setSelectedStudentId(next ? next.student_id : roster[0]?.student_id ?? null)
        setAyahs([])
        setAyahRange(null)
        resetMarks()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
            </div>
        )
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 p-4 h-[calc(100vh-4rem)]" dir={isAr ? 'rtl' : 'ltr'}>
            {/* Roster sidebar */}
            <div className="lg:w-64 shrink-0 space-y-1 overflow-y-auto">
                <h2 className="text-sm font-semibold text-muted-foreground px-2 mb-2">{t('selectStudent')}</h2>
                {roster.map((e) => (
                    <button
                        key={e.id}
                        onClick={() => { setSelectedStudentId(e.student_id); setAyahs([]); setAyahRange(null); resetMarks() }}
                        className={cn(
                            'w-full text-start px-3 py-2 rounded-md text-sm transition-colors',
                            selectedStudentId === e.student_id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        )}
                    >
                        {e.students?.profile ? `${e.students.profile.first_name} ${e.students.profile.last_name}` : e.students?.student_number}
                    </button>
                ))}
            </div>

            {/* Main pane */}
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                <Card>
                    <CardContent className="p-4 flex flex-wrap items-end gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">{t('sessionType')}</Label>
                            <select value={sessionType} onChange={(e) => setSessionType(e.target.value as any)} className="h-9 rounded-md border px-2 text-sm">
                                {SESSION_TYPES.map((s) => <option key={s} value={s}>{t(s as any)}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">{t('riwayah')}</Label>
                            <select value={riwayahCode} onChange={(e) => setRiwayahCode(e.target.value)} className="h-9 rounded-md border px-2 text-sm">
                                {riwayat.map((r) => <option key={r.code} value={r.code}>{isAr ? r.name_ar : r.name_en}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1 w-20">
                            <Label className="text-xs">Surah</Label>
                            <Input type="number" min={1} max={114} value={surahNumber} onChange={(e) => setSurahNumber(e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1 w-20">
                            <Label className="text-xs">From</Label>
                            <Input type="number" min={1} value={startAyah} onChange={(e) => setStartAyah(e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1 w-20">
                            <Label className="text-xs">To</Label>
                            <Input type="number" min={1} value={endAyah} onChange={(e) => setEndAyah(e.target.value)} className="h-9" />
                        </div>
                        <Button onClick={handleLoadText} disabled={loadingText || !selectedStudentId} size="sm">
                            {loadingText ? <Loader2 className="h-4 w-4 animate-spin" /> : t('range')}
                        </Button>
                        {ayahs.length > 0 && <SessionTimer key={selectedStudentId} startedAt={sessionStartedAt} />}
                    </CardContent>
                </Card>

                {ayahs.length > 0 ? (
                    <>
                        <p className="text-xs text-muted-foreground">{t('tapWordHint')}</p>
                        <RecitationPane
                            ayahs={ayahs}
                            marks={marks}
                            activePickerKey={activePickerKey}
                            onWordTap={handleWordTap}
                            onSelectType={handleSelectType}
                        />

                        <Card>
                            <CardContent className="p-4 flex flex-wrap items-center gap-4">
                                <Button variant="outline" size="sm" onClick={handleUndo} disabled={markOrder.length === 0}>
                                    <Undo2 className="h-4 w-4 me-1" />
                                    {t('undo')}
                                </Button>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">{t('score')}:</span>
                                    <span className="text-lg font-bold">{preview !== null ? preview.toFixed(2) : '—'}</span>
                                </div>

                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={overrideEnabled} onChange={(e) => setOverrideEnabled(e.target.checked)} />
                                    {t('overrideScore')}
                                </label>

                                {overrideEnabled && (
                                    <>
                                        <Input
                                            type="number" min={0} max={10} step={0.25}
                                            value={overrideScore}
                                            onChange={(e) => setOverrideScore(e.target.value)}
                                            className="h-9 w-20"
                                        />
                                        <Input
                                            value={overrideReason}
                                            onChange={(e) => setOverrideReason(e.target.value)}
                                            placeholder={t('overrideReason')}
                                            className="h-9 flex-1 min-w-[160px]"
                                        />
                                    </>
                                )}

                                <div className="flex-1" />

                                <Button variant="ghost" size="sm" onClick={handleNextStudent}>
                                    {t('nextStudent')}
                                    <ChevronRight className="h-4 w-4 ms-1" />
                                </Button>

                                <Button onClick={handleSave} disabled={saving} className="gradient-blue text-white border-0">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Check className="h-4 w-4 me-2" />}
                                    {saving ? t('saving') : t('save')}
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card className="flex-1 border-dashed">
                        <CardContent className="p-12 text-center text-sm text-muted-foreground">
                            {t('range')}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
