'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Download, BookOpen, Plus } from 'lucide-react'
import { getCircles, getEnrollments, getHeatmap, openReportCard, type HifziCircle, type HifziEnrollment, type HeatmapCell } from '@/lib/api/hifzi'
import { MushafHeatmap } from '@/components/hifzi/MushafHeatmap'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

export default function AdminHifziReportsPage() {
    const t = useTranslations('hifzi')
    const tc = useTranslations('hifzi.circles')
    const ts = useTranslations('hifzi.students')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [circlesLoaded, setCirclesLoaded] = useState(false)
    const [circleId, setCircleId] = useState('')
    const [roster, setRoster] = useState<HifziEnrollment[]>([])
    const [studentId, setStudentId] = useState('')
    const [cells, setCells] = useState<HeatmapCell[]>([])
    const [loading, setLoading] = useState(false)
    const [generating, setGenerating] = useState(false)

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

    const fetchHeatmap = useCallback(async () => {
        if (!studentId) return
        setLoading(true)
        const res = await getHeatmap(studentId, campusId)
        if (res.success && res.data) setCells(res.data)
        else if (!res.success) toast.error(`Failed to load heatmap: ${res.error || 'unknown error'}`)
        setLoading(false)
    }, [studentId, campusId])

    useEffect(() => { fetchHeatmap() }, [fetchHeatmap])

    const handleDownload = async () => {
        if (!studentId) return
        setGenerating(true)
        const res = await openReportCard(studentId, campusId)
        if (!res.success) toast.error(res.error || t('reports.generateError'))
        setGenerating(false)
    }

    return (
        <div className="space-y-4 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('reports.title')}
                </h1>
                <Button variant="outline" size="sm" onClick={handleDownload} disabled={generating || !studentId}>
                    {generating ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Download className="h-4 w-4 me-2" />}
                    {t('reports.downloadPdf')}
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
                    ) : (
                        <Card>
                            <CardContent className="p-5">
                                <MushafHeatmap cells={cells} />
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
