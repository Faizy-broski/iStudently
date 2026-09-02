'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'
import { Plus, Users, RefreshCw, BookOpen, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getCircles, setCircleSchedulingMode, type HifziCircle } from '@/lib/api/hifzi'
import { CircleDialog } from '@/components/admin/hifzi/CircleDialog'
import { AssignTeacherDialog } from '@/components/admin/hifzi/AssignTeacherDialog'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

const GENDER_COLORS: Record<string, string> = {
    male: 'bg-blue-100 text-blue-800',
    female: 'bg-pink-100 text-pink-800',
    mixed: 'bg-gray-100 text-gray-800',
}

export default function HifziCirclesPage() {
    const t = useTranslations('hifzi.circles')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [teacherDialogCircleId, setTeacherDialogCircleId] = useState<string | null>(null)
    const teacherDialogCircle = circles.find((c) => c.id === teacherDialogCircleId) || null
    const [togglingId, setTogglingId] = useState<string | null>(null)

    const fetchCircles = useCallback(async () => {
        setLoading(true)
        const res = await getCircles(campusId)
        if (res.success && res.data) setCircles(res.data)
        else if (!res.success) toast.error(`Failed to load circles: ${res.error || 'unknown error'}`)
        setLoading(false)
    }, [campusId])

    useEffect(() => { fetchCircles() }, [fetchCircles])

    // Ministerial Decree 1205 compliance, Phase 4: freeform (the default,
    // scheduled purely via each circle's own weekly slots) stays the norm —
    // this only lets an admin explicitly opt a circle into the school's real
    // bell-schedule/timetable generator, for circles that genuinely run
    // inside a real period. See migration 277's header comment for why this
    // is deliberately narrow and opt-in, not a default behavior change.
    const handleToggleSchedulingMode = async (circle: HifziCircle) => {
        const nextMode = circle.scheduling_mode === 'bell_schedule' ? 'freeform' : 'bell_schedule'
        setTogglingId(circle.id)
        try {
            const res = await setCircleSchedulingMode(circle.id, nextMode, campusId)
            if (res.success) {
                toast.success(nextMode === 'bell_schedule' ? t('schedulingModeBellSuccess') : t('schedulingModeFreeformSuccess'))
                if (nextMode === 'bell_schedule' && res.data && !res.data.synced) {
                    toast.error(`${t('schedulingModeSyncIncomplete')}: ${res.data.reason}`)
                }
                fetchCircles()
            } else {
                toast.error(res.error || t('schedulingModeError'))
            }
        } finally {
            setTogglingId(null)
        }
    }

    return (
        <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                        {t('title')}
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchCircles} disabled={loading}>
                        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </Button>
                    <Button className="gradient-blue text-white border-0 gap-2" onClick={() => setDialogOpen(true)}>
                        <Plus className="h-4 w-4" />
                        {t('create')}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : circles.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200">
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 gradient-blue rounded-full flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="h-8 w-8 text-white" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{t('noCircles')}</p>
                        <Button className="gradient-blue text-white border-0" onClick={() => setDialogOpen(true)}>
                            <Plus className="h-4 w-4 me-2" />
                            {t('create')}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {circles.map((circle) => (
                        <Card key={circle.id} className="border">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-semibold">{circle.name_ar}</p>
                                        {circle.name_en && <p className="text-xs text-muted-foreground">{circle.name_en}</p>}
                                    </div>
                                    <Badge className={cn('text-xs', GENDER_COLORS[circle.section_gender])}>
                                        {t(circle.section_gender as any)}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {circle.hifzi_circle_teachers?.filter((t) => !t.active_to).length ?? 0} {t('teachers')}
                                    </span>
                                    <span>{circle.capacity ? `${t('capacity')}: ${circle.capacity}` : ''}</span>
                                </div>

                                {circle.hifzi_circle_schedules && circle.hifzi_circle_schedules.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                        {circle.hifzi_circle_schedules.length} {t('schedule').toLowerCase()}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => handleToggleSchedulingMode(circle)}
                                    disabled={togglingId === circle.id}
                                    className={cn(
                                        'flex items-center gap-1.5 text-xs rounded-md px-2 py-1 w-fit disabled:opacity-60',
                                        circle.scheduling_mode === 'bell_schedule' ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'
                                    )}
                                    title={t('schedulingModeToggleHint')}
                                >
                                    <CalendarClock className="h-3 w-3" />
                                    {circle.scheduling_mode === 'bell_schedule' ? t('schedulingModeBellSchedule') : t('schedulingModeFreeform')}
                                </button>

                                <div className="flex items-center justify-between gap-2 mt-1">
                                    <Link
                                        href={`/admin/hifzi/students?circle_id=${circle.id}`}
                                        className="text-xs text-primary hover:underline"
                                    >
                                        {t('title')} →
                                    </Link>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 gap-1 text-xs"
                                        onClick={() => setTeacherDialogCircleId(circle.id)}
                                    >
                                        <Users className="h-3 w-3" />
                                        {t('teachers')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CircleDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={(c) => setCircles((prev) => [...prev, c])} campusId={campusId} />

            {teacherDialogCircle && (
                <AssignTeacherDialog
                    open={!!teacherDialogCircleId}
                    onOpenChange={(v) => setTeacherDialogCircleId(v ? teacherDialogCircleId : null)}
                    circle={teacherDialogCircle}
                    onChanged={fetchCircles}
                    campusId={campusId}
                />
            )}
        </div>
    )
}
