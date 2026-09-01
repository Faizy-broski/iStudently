'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, BookOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { getCircles, getEnrollments, getAssignment, generateAssignment, getPlans, deletePlan, type HifziCircle, type HifziEnrollment } from '@/lib/api/hifzi'
import { getRiwayat, type QuranRiwayah } from '@/lib/api/quran'
import { CreatePlanDialog } from '@/components/admin/hifzi/CreatePlanDialog'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

interface HifziPlan {
    id: string
    plan_type: string
    riwayah_id: string
    daily_new_ayat_target: number | null
    created_at: string
}

interface AssignmentItem {
    id: string
    item_type: string
    reason_code: string
    hifzi_reason_codes?: { label_ar: string; label_en: string }
}

// Admin's view mirrors the teacher plans page (frontend/src/app/teacher/hifzi/plans/page.tsx)
// with one addition: a manual "regenerate" action (spec's assignments/generate endpoint),
// admin-only per backend/src/routes/hifzi/plans.routes.ts.
export default function AdminHifziPlansPage() {
    const t = useTranslations('hifzi')
    const tc = useTranslations('hifzi.circles')
    const ts = useTranslations('hifzi.students')
    const tp = useTranslations('hifzi.plans')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [circlesLoaded, setCirclesLoaded] = useState(false)
    const [circleId, setCircleId] = useState('')
    const [roster, setRoster] = useState<HifziEnrollment[]>([])
    const [studentId, setStudentId] = useState('')
    const [items, setItems] = useState<AssignmentItem[]>([])
    const [loading, setLoading] = useState(false)
    const [regenerating, setRegenerating] = useState(false)
    const [plan, setPlan] = useState<HifziPlan | null | undefined>(undefined) // undefined = not checked yet
    const [riwayat, setRiwayat] = useState<QuranRiwayah[]>([])
    const [planDialogOpen, setPlanDialogOpen] = useState(false)
    const [editingPlan, setEditingPlan] = useState<HifziPlan | null>(null)
    const [deletingPlan, setDeletingPlan] = useState(false)

    useEffect(() => {
        getRiwayat().then((res) => { if (res.success && res.data) setRiwayat(res.data) })
    }, [])

    useEffect(() => {
        getCircles(campusId).then((res) => {
            if (res.success && res.data) {
                setCircles(res.data)
                if (res.data.length > 0) setCircleId(res.data[0].id)
            } else if (!res.success) {
                toast.error(`Failed to load circles: ${res.error || 'unknown error'}`)
            }
            setCirclesLoaded(true)
        })
    }, [campusId])

    useEffect(() => {
        if (!circleId) return
        getEnrollments(circleId, campusId).then((res) => {
            if (res.success && res.data) {
                setRoster(res.data)
                if (res.data.length > 0) setStudentId(res.data[0].student_id)
            } else if (!res.success) {
                toast.error(`Failed to load roster: ${res.error || 'unknown error'}`)
            }
        })
    }, [circleId, campusId])

    const fetchAssignment = useCallback(async () => {
        if (!studentId) return
        setLoading(true)
        const res = await getAssignment(studentId, undefined, campusId)
        if (!res.success) toast.error(`Failed to load assignment: ${res.error || 'unknown error'}`)
        const data = res.data as any
        setItems(data?.hifzi_assignment_items ?? [])
        setLoading(false)
    }, [studentId, campusId])

    useEffect(() => { fetchAssignment() }, [fetchAssignment])

    const checkPlan = useCallback(async () => {
        if (!studentId) return
        setPlan(undefined)
        const res = await getPlans(studentId, campusId)
        const plans = (res.data as HifziPlan[] | undefined) ?? []
        setPlan(res.success ? (plans[0] ?? null) : null)
    }, [studentId, campusId])

    useEffect(() => { checkPlan() }, [checkPlan])

    const handleDeletePlan = async () => {
        if (!plan) return
        if (!confirm(tp('deleteConfirm'))) return
        setDeletingPlan(true)
        const res = await deletePlan(plan.id, campusId)
        if (res.success) {
            toast.success(tp('deleteSuccess'))
            checkPlan()
        } else {
            toast.error(res.error || tp('deleteError'))
        }
        setDeletingPlan(false)
    }

    const handleRegenerate = async () => {
        if (!studentId) return
        setRegenerating(true)
        const res = await generateAssignment(studentId, undefined, campusId)
        if (res.success) {
            toast.success('Regenerated')
            fetchAssignment()
        } else {
            toast.error(res.error || 'Failed')
        }
        setRegenerating(false)
    }

    return (
        <div className="space-y-4 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('recitation.title')}
                </h1>
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating || !studentId}>
                    <RefreshCw className={regenerating ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                </Button>
            </div>

            {!circlesLoaded ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : circles.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200">
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="h-8 w-8 text-white" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{tc('noCircles')}</p>
                        <Button asChild className="gradient-blue text-white border-0">
                            <Link href="/admin/hifzi/circles">
                                <Plus className="h-4 w-4 me-2" />
                                {tc('create')}
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="flex gap-2 flex-wrap">
                        <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                            {circles.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                        </select>
                        {roster.length > 0 && (
                            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                                {roster.map((e) => (
                                    <option key={e.id} value={e.student_id}>
                                        {e.students?.profile ? `${e.students.profile.first_name} ${e.students.profile.last_name}` : e.students?.student_number}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {roster.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {ts('noStudents')}{' '}
                            <Link href={`/admin/hifzi/students?circle_id=${circleId}`} className="underline text-primary">
                                {ts('enroll')}
                            </Link>
                        </p>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : plan === undefined ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : plan === null ? (
                        <Card className="border-2 border-dashed border-gray-200">
                            <CardContent className="p-8 text-center space-y-3">
                                <p className="text-sm text-muted-foreground">{tp('noPlanYet')}</p>
                                <Button onClick={() => { setEditingPlan(null); setPlanDialogOpen(true) }} className="gradient-blue text-white border-0">
                                    <Plus className="h-4 w-4 me-2" />
                                    {tp('create')}
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <Card className="bg-muted/30">
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge>{tp(`planType_${plan.plan_type}` as any)}</Badge>
                                            <span className="text-sm">
                                                {riwayat.find((r) => r.id === plan.riwayah_id)?.[isAr ? 'name_ar' : 'name_en'] || plan.riwayah_id}
                                            </span>
                                            {plan.daily_new_ayat_target != null && (
                                                <span className="text-sm text-muted-foreground">· {tp('dailyTargetLabel')}: {plan.daily_new_ayat_target}</span>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => { setEditingPlan(plan); setPlanDialogOpen(true) }} title={tp('edit')}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={handleDeletePlan} disabled={deletingPlan} title={tp('delete')}>
                                                {deletingPlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
                                            </Button>
                                        </div>
                                    </div>
                                    {items.length === 0 && <p className="text-xs text-muted-foreground">{tp('corpusNote')}</p>}
                                </CardContent>
                            </Card>

                            {items.length > 0 && (
                                <div className="space-y-2">
                                    {items.map((item) => (
                                        <Card key={item.id}>
                                            <CardContent className="p-3 flex items-center justify-between gap-3">
                                                <Badge variant="secondary">{t(`recitation.${item.item_type}` as any)}</Badge>
                                                <span className="text-sm text-muted-foreground flex-1">
                                                    {isAr ? item.hifzi_reason_codes?.label_ar : item.hifzi_reason_codes?.label_en}
                                                </span>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            <CreatePlanDialog
                open={planDialogOpen}
                onOpenChange={(v) => { setPlanDialogOpen(v); if (!v) setEditingPlan(null) }}
                studentId={studentId}
                circleId={circleId}
                campusId={campusId}
                editingPlan={editingPlan}
                onCreated={() => { checkPlan(); fetchAssignment() }}
            />
        </div>
    )
}
