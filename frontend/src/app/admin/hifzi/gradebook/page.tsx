'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, Save, Eye, UploadCloud, Link2 } from 'lucide-react'
import {
    getGradebookLink,
    linkGradebookSubject,
    previewGradebookBridge,
    runGradebookBridge,
    type HifziGradebookLink,
    type HifziGradebookBridgePreviewRow,
    type HifziGradebookBridgeResult,
} from '@/lib/api/hifzi'
import { getGradeLevels, getSubjects, type GradeLevel, type Subject } from '@/lib/api/academics'
import { getCourses, type Course } from '@/lib/api/grades'
import { getMarkingPeriods, type MarkingPeriod } from '@/lib/api/marking-periods'
import { getCurrentAcademicYear, type AcademicYear } from '@/lib/api/academics'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

// Ministerial Decree 1205 compliance, Phase 2: links a grade's Quran
// subject/course (set up through the normal admin academics flow, not here)
// to a CA/Exam weight split, then previews and pushes a per-term blend of
// hifzi_sessions data into the shared gradebook (student_final_grades) —
// after which Quran marks appear in the standard report card automatically,
// no changes needed to report-cards.service.ts.
export default function HifziGradebookPage() {
    const t = useTranslations('hifzi.gradebook')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
    const [subjects, setSubjects] = useState<Subject[]>([])
    const [courses, setCourses] = useState<Course[]>([])
    const [markingPeriods, setMarkingPeriods] = useState<MarkingPeriod[]>([])
    const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)

    const [gradeLevelId, setGradeLevelId] = useState('')
    const [markingPeriodId, setMarkingPeriodId] = useState('')
    const [link, setLink] = useState<HifziGradebookLink | null>(null)
    const [loading, setLoading] = useState(true)

    const [subjectId, setSubjectId] = useState('')
    const [courseId, setCourseId] = useState('')
    const [caWeight, setCaWeight] = useState('70')
    const [saving, setSaving] = useState(false)

    const [previewRows, setPreviewRows] = useState<HifziGradebookBridgePreviewRow[] | null>(null)
    const [previewing, setPreviewing] = useState(false)
    const [running, setRunning] = useState(false)
    const [runResult, setRunResult] = useState<HifziGradebookBridgeResult | null>(null)

    useEffect(() => {
        setLoading(true)
        Promise.all([
            getGradeLevels(campusId ?? undefined),
            getCourses(campusId ?? undefined),
            getMarkingPeriods(campusId ?? undefined).catch(() => []),
            getCurrentAcademicYear(),
        ]).then(([gradesRes, coursesRes, mps, year]) => {
            if (gradesRes.success && gradesRes.data) {
                setGradeLevels(gradesRes.data)
                if (gradesRes.data.length > 0) setGradeLevelId(gradesRes.data[0].id)
            }
            if (coursesRes.success && coursesRes.data) setCourses(coursesRes.data)
            setMarkingPeriods(mps)
            if (mps.length > 0) setMarkingPeriodId(mps[0].id)
            setAcademicYear(year)
            setLoading(false)
        })
    }, [campusId])

    const fetchGradeContext = useCallback(async () => {
        if (!gradeLevelId || !academicYear) return
        const [subjectsRes, linkRes] = await Promise.all([
            getSubjects(gradeLevelId, campusId ?? undefined),
            getGradebookLink(gradeLevelId, academicYear.id, campusId),
        ])
        if (subjectsRes.success && subjectsRes.data) setSubjects(subjectsRes.data)
        if (linkRes.success) {
            setLink(linkRes.data ?? null)
            if (linkRes.data) {
                setSubjectId(linkRes.data.subject_id)
                setCourseId(linkRes.data.course_id)
                setCaWeight(String(linkRes.data.ca_weight_percent))
            } else {
                setSubjectId('')
                setCourseId('')
                setCaWeight('70')
            }
        }
        setPreviewRows(null)
        setRunResult(null)
    }, [gradeLevelId, academicYear, campusId])

    useEffect(() => { fetchGradeContext() }, [fetchGradeContext])

    const coursesForSubject = courses.filter((c) => c.subject_id === subjectId)

    const handleSaveLink = async () => {
        if (!gradeLevelId || !academicYear || !subjectId || !courseId) return
        const ca = Number(caWeight)
        if (!(ca >= 0 && ca <= 100)) {
            toast.error(t('invalidWeight'))
            return
        }
        setSaving(true)
        try {
            const res = await linkGradebookSubject(
                {
                    grade_level_id: gradeLevelId,
                    academic_year_id: academicYear.id,
                    subject_id: subjectId,
                    course_id: courseId,
                    ca_weight_percent: ca,
                    exam_weight_percent: 100 - ca,
                },
                campusId
            )
            if (res.success && res.data) {
                toast.success(t('linkSaved'))
                setLink(res.data)
            } else {
                toast.error(res.error || t('linkError'))
            }
        } finally {
            setSaving(false)
        }
    }

    const handlePreview = async () => {
        if (!gradeLevelId || !academicYear || !markingPeriodId) return
        setPreviewing(true)
        setRunResult(null)
        try {
            const res = await previewGradebookBridge(gradeLevelId, academicYear.id, markingPeriodId, campusId)
            if (res.success && res.data) setPreviewRows(res.data)
            else toast.error(res.error || t('previewError'))
        } finally {
            setPreviewing(false)
        }
    }

    const handleRun = async () => {
        if (!gradeLevelId || !academicYear || !markingPeriodId) return
        setRunning(true)
        try {
            const res = await runGradebookBridge(gradeLevelId, academicYear.id, markingPeriodId, campusId)
            if (res.success && res.data) {
                setRunResult(res.data)
                toast.success(t('runSuccess', { saved: res.data.saved, skipped: res.data.skipped }))
            } else {
                toast.error(res.error || t('runError'))
            }
        } finally {
            setRunning(false)
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

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                    <Label className="text-xs">{t('gradeLevel')}</Label>
                    <select value={gradeLevelId} onChange={(e) => setGradeLevelId(e.target.value)} className="h-9 w-full rounded-md border px-2 text-sm">
                        {gradeLevels.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs">{t('markingPeriod')}</Label>
                    <select value={markingPeriodId} onChange={(e) => setMarkingPeriodId(e.target.value)} className="h-9 w-full rounded-md border px-2 text-sm">
                        {markingPeriods.map((mp) => <option key={mp.id} value={mp.id}>{mp.title}</option>)}
                    </select>
                </div>
            </div>

            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold text-sm">{t('linkSectionTitle')}</p>
                        {link && <span className="text-xs text-green-600">{t('linked')}</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">{t('subject')}</Label>
                            <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setCourseId('') }} className="h-9 w-full rounded-md border px-2 text-sm">
                                <option value="">{t('selectSubject')}</option>
                                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">{t('course')}</Label>
                            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={!subjectId} className="h-9 w-full rounded-md border px-2 text-sm">
                                <option value="">{t('selectCourse')}</option>
                                {coursesForSubject.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">{t('caWeight')}</Label>
                            <Input type="number" min={0} max={100} value={caWeight} onChange={(e) => setCaWeight(e.target.value)} className="h-9" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">{t('examWeight')}</Label>
                            <Input type="number" value={100 - (Number(caWeight) || 0)} disabled className="h-9 bg-muted" />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button size="sm" onClick={handleSaveLink} disabled={saving || !subjectId || !courseId} className="gradient-blue text-white border-0 gap-2">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {t('saveLink')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{t('bridgeSectionTitle')}</p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={handlePreview} disabled={previewing || !link} className="gap-2">
                                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                {t('preview')}
                            </Button>
                            <Button size="sm" onClick={handleRun} disabled={running || !link} className="gradient-blue text-white border-0 gap-2">
                                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                                {t('pushToGradebook')}
                            </Button>
                        </div>
                    </div>

                    {!link && <p className="text-xs text-muted-foreground">{t('noLinkYet')}</p>}

                    {runResult && (
                        <div className="text-xs rounded-md border p-3 space-y-1">
                            <p>{t('runSummary', { processed: runResult.processed, saved: runResult.saved, skipped: runResult.skipped })}</p>
                            {runResult.errors.length > 0 && (
                                <ul className="list-disc ps-4 text-red-600">
                                    {runResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            )}
                        </div>
                    )}

                    {previewRows && (
                        previewRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">{t('noStudents')}</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-muted-foreground border-b">
                                            <th className="text-start py-2">{t('student')}</th>
                                            <th className="text-start py-2">{t('caPercent')}</th>
                                            <th className="text-start py-2">{t('examPercent')}</th>
                                            <th className="text-start py-2">{t('finalPercent')}</th>
                                            <th className="text-start py-2">{t('letterGrade')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {previewRows.map((row) => (
                                            <tr key={row.studentId}>
                                                <td className="py-2">{row.studentName}</td>
                                                <td className="py-2">{row.caPercent !== null ? row.caPercent.toFixed(1) : '—'}</td>
                                                <td className="py-2">{row.examPercent !== null ? row.examPercent.toFixed(1) : '—'}</td>
                                                <td className="py-2 font-semibold">{row.finalPercent !== null ? row.finalPercent.toFixed(1) : '—'}</td>
                                                <td className="py-2">{row.letterGrade ?? '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
