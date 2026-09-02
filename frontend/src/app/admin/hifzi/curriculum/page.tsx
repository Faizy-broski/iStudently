'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Save, BookOpen } from 'lucide-react'
import { getSyllabusTargets, upsertSyllabusTarget, type HifziSyllabusTarget } from '@/lib/api/hifzi'
import { getRiwayat, type QuranRiwayah } from '@/lib/api/quran'
import { getGradeLevels, getCurrentAcademicYear, type GradeLevel, type AcademicYear } from '@/lib/api/academics'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

// Ministerial Decree 1205 compliance, Phase 1a: maps each of the school's
// grade levels to a ministry-mandated Quran memorization range for the
// current academic year. Everything downstream (syllabus-completion %,
// parent "grade completed" milestones, the future gradebook bridge)
// measures against what's set here.
const DIVISION_UNIT_TYPES = ['juz', 'hizb', 'rub', 'thumn'] as const
type DivisionUnitType = (typeof DIVISION_UNIT_TYPES)[number]

interface RowDraft {
    ministryGradeNumber: string
    riwayahId: string
    unitType: DivisionUnitType
    startNumber: string
    endNumber: string
    unitLabel: string
}

export default function HifziCurriculumPage() {
    const t = useTranslations('hifzi.curriculum')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
    const [riwayat, setRiwayat] = useState<QuranRiwayah[]>([])
    const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
    const [targets, setTargets] = useState<Record<string, HifziSyllabusTarget>>({})
    const [drafts, setDrafts] = useState<Record<string, RowDraft>>({})
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)

    const fetchAll = useCallback(async () => {
        setLoading(true)
        const [gradesRes, riwayatRes, year] = await Promise.all([
            getGradeLevels(campusId ?? undefined),
            getRiwayat(),
            getCurrentAcademicYear(),
        ])
        if (gradesRes.success && gradesRes.data) setGradeLevels(gradesRes.data)
        if (riwayatRes.success && riwayatRes.data) setRiwayat(riwayatRes.data)
        setAcademicYear(year)

        if (year) {
            const targetsRes = await getSyllabusTargets(year.id, undefined, campusId)
            if (targetsRes.success && targetsRes.data) {
                const byGrade: Record<string, HifziSyllabusTarget> = {}
                for (const target of targetsRes.data) byGrade[target.grade_level_id] = target
                setTargets(byGrade)
            }
        }
        setLoading(false)
    }, [campusId])

    useEffect(() => { fetchAll() }, [fetchAll])

    const draftFor = (grade: GradeLevel): RowDraft => {
        if (drafts[grade.id]) return drafts[grade.id]
        const existing = targets[grade.id]
        return {
            ministryGradeNumber: '',
            riwayahId: riwayat[0]?.id ?? '',
            unitType: 'thumn',
            startNumber: '',
            endNumber: '',
            unitLabel: existing?.unit_label ?? '',
        }
    }

    const updateDraft = (gradeId: string, patch: Partial<RowDraft>) => {
        setDrafts((prev) => ({ ...prev, [gradeId]: { ...draftFor(gradeLevels.find((g) => g.id === gradeId)!), ...prev[gradeId], ...patch } }))
    }

    const handleSave = async (grade: GradeLevel) => {
        const draft = draftFor(grade)
        const ministryGradeNumber = Number(draft.ministryGradeNumber)
        const startNumber = Number(draft.startNumber)
        const endNumber = Number(draft.endNumber)
        if (!ministryGradeNumber || ministryGradeNumber < 1 || ministryGradeNumber > 12) {
            toast.error(t('invalidMinistryGrade'))
            return
        }
        if (!draft.riwayahId || !startNumber || !endNumber) {
            toast.error(t('incompleteRange'))
            return
        }
        if (!academicYear) return

        setSavingId(grade.id)
        try {
            const res = await upsertSyllabusTarget(
                {
                    grade_level_id: grade.id,
                    ministry_grade_number: ministryGradeNumber,
                    academic_year_id: academicYear.id,
                    riwayah_id: draft.riwayahId,
                    range: { unit_type: draft.unitType, start_number: startNumber, end_number: endNumber },
                    unit_label: draft.unitLabel || undefined,
                },
                campusId
            )
            if (res.success && res.data) {
                toast.success(t('saveSuccess'))
                setTargets((prev) => ({ ...prev, [grade.id]: res.data! }))
            } else {
                toast.error(res.error || t('saveError'))
            }
        } finally {
            setSavingId(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-[#022172]" />
            </div>
        )
    }

    return (
        <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {gradeLevels.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200">
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="h-8 w-8 text-white" />
                        </div>
                        <p className="text-sm text-muted-foreground">{t('noGradeLevels')}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {gradeLevels.map((grade) => {
                        const draft = draftFor(grade)
                        const existing = targets[grade.id]
                        return (
                            <Card key={grade.id}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold">{grade.name}</p>
                                        {existing && <p className="text-xs text-muted-foreground">{existing.unit_label || t('mapped')}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('ministryGrade')}</Label>
                                            <Input
                                                type="number" min={1} max={12}
                                                value={draft.ministryGradeNumber}
                                                onChange={(e) => updateDraft(grade.id, { ministryGradeNumber: e.target.value })}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('riwayah')}</Label>
                                            <select
                                                value={draft.riwayahId}
                                                onChange={(e) => updateDraft(grade.id, { riwayahId: e.target.value })}
                                                className="h-9 w-full rounded-md border px-2 text-sm"
                                            >
                                                {riwayat.map((r) => <option key={r.id} value={r.id}>{isAr ? r.name_ar : r.name_en}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('unitType')}</Label>
                                            <select
                                                value={draft.unitType}
                                                onChange={(e) => updateDraft(grade.id, { unitType: e.target.value as DivisionUnitType })}
                                                className="h-9 w-full rounded-md border px-2 text-sm"
                                            >
                                                {DIVISION_UNIT_TYPES.map((u) => <option key={u} value={u}>{t(`unitTypes.${u}`)}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('from')}</Label>
                                            <Input
                                                type="number" min={1}
                                                value={draft.startNumber}
                                                onChange={(e) => updateDraft(grade.id, { startNumber: e.target.value })}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('to')}</Label>
                                            <Input
                                                type="number" min={1}
                                                value={draft.endNumber}
                                                onChange={(e) => updateDraft(grade.id, { endNumber: e.target.value })}
                                                className="h-9"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">{t('unitLabel')}</Label>
                                            <Input
                                                value={draft.unitLabel}
                                                onChange={(e) => updateDraft(grade.id, { unitLabel: e.target.value })}
                                                placeholder={t('unitLabelPlaceholder')}
                                                className="h-9"
                                                dir={isAr ? 'rtl' : 'ltr'}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button size="sm" onClick={() => handleSave(grade)} disabled={savingId === grade.id} className="gradient-blue text-white border-0 gap-2">
                                            {savingId === grade.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                            {t('save')}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
