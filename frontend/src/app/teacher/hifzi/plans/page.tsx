'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { getCircles, getEnrollments, getAssignment, type HifziCircle, type HifziEnrollment } from '@/lib/api/hifzi'
import { toast } from 'sonner'

interface AssignmentItem {
    id: string
    item_type: string
    reason_code: string
    hifzi_reason_codes?: { label_ar: string; label_en: string }
}

export default function TeacherHifziPlansPage() {
    const t = useTranslations('hifzi')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [circlesLoaded, setCirclesLoaded] = useState(false)
    const [circleId, setCircleId] = useState('')
    const [roster, setRoster] = useState<HifziEnrollment[]>([])
    const [studentId, setStudentId] = useState('')
    const [items, setItems] = useState<AssignmentItem[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        getCircles().then((res) => {
            if (res.success && res.data) {
                setCircles(res.data)
                if (res.data.length > 0) setCircleId(res.data[0].id)
            } else if (!res.success) {
                toast.error(`Failed to load circles: ${res.error || 'unknown error'}`)
            }
            setCirclesLoaded(true)
        })
    }, [])

    useEffect(() => {
        if (!circleId) return
        getEnrollments(circleId).then((res) => {
            if (res.success && res.data) {
                setRoster(res.data)
                if (res.data.length > 0) setStudentId(res.data[0].student_id)
            } else if (!res.success) {
                toast.error(`Failed to load roster: ${res.error || 'unknown error'}`)
            }
        })
    }, [circleId])

    const fetchAssignment = useCallback(async () => {
        if (!studentId) return
        setLoading(true)
        const res = await getAssignment(studentId)
        if (!res.success) toast.error(`Failed to load assignment: ${res.error || 'unknown error'}`)
        const data = res.data as any
        setItems(data?.hifzi_assignment_items ?? [])
        setLoading(false)
    }, [studentId])

    useEffect(() => { fetchAssignment() }, [fetchAssignment])

    return (
        <div className="space-y-4 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                {t('plans.title') || 'Plans'}
            </h1>

            {!circlesLoaded ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : circles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('circles.noCircles')}</p>
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
                        <p className="text-sm text-muted-foreground">{t('students.noStudents')}</p>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">—</p>
                    ) : (
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
        </div>
    )
}
