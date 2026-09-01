'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Save, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCircles, getEnrollments, markAttendanceBulk, type HifziCircle, type HifziEnrollment } from '@/lib/api/hifzi'
import { toast } from 'sonner'

const STATUSES = ['present', 'late', 'absent_excused', 'absent_unexcused', 'permitted', 'on_leave'] as const
type Status = (typeof STATUSES)[number]

const STATUS_COLORS: Record<Status, string> = {
    present: 'bg-green-100 text-green-800 border-green-300',
    late: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    absent_excused: 'bg-blue-100 text-blue-800 border-blue-300',
    absent_unexcused: 'bg-red-100 text-red-800 border-red-300',
    permitted: 'bg-purple-100 text-purple-800 border-purple-300',
    on_leave: 'bg-gray-100 text-gray-800 border-gray-300',
}

export default function TeacherHifziAttendancePage() {
    const t = useTranslations('hifzi.attendance')
    const tc = useTranslations('hifzi.circles')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [circlesLoaded, setCirclesLoaded] = useState(false)
    const [circleId, setCircleId] = useState('')
    const [roster, setRoster] = useState<HifziEnrollment[]>([])
    const [statuses, setStatuses] = useState<Record<string, Status>>({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const today = new Date().toISOString().slice(0, 10)

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

    const fetchRoster = useCallback(async () => {
        if (!circleId) return
        setLoading(true)
        const res = await getEnrollments(circleId)
        if (res.success && res.data) {
            setRoster(res.data)
            setStatuses(Object.fromEntries(res.data.map((e) => [e.student_id, 'present' as Status])))
        } else if (!res.success) {
            toast.error(`Failed to load roster: ${res.error || 'unknown error'}`)
        }
        setLoading(false)
    }, [circleId])

    useEffect(() => { fetchRoster() }, [fetchRoster])

    const markAllPresent = () => setStatuses(Object.fromEntries(roster.map((e) => [e.student_id, 'present' as Status])))

    const handleSave = async () => {
        setSaving(true)
        const res = await markAttendanceBulk(circleId, today, roster.map((e) => ({ student_id: e.student_id, status: statuses[e.student_id] })))
        if (res.success) {
            toast.success(t('save'))
        } else {
            toast.error(res.error || 'Failed to save')
        }
        setSaving(false)
    }

    return (
        <div className="space-y-4 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('title')}
                </h1>
                {circles.length > 0 && (
                    <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                        {circles.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                    </select>
                )}
            </div>

            {!circlesLoaded ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : circles.length === 0 ? (
                <p className="text-sm text-muted-foreground">{tc('noCircles')}</p>
            ) : loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
                <>
                    <Button variant="outline" size="sm" onClick={markAllPresent}>
                        <CheckCheck className="h-4 w-4 me-1" />
                        {t('markAll')}
                    </Button>

                    <div className="space-y-2">
                        {roster.map((e) => (
                            <Card key={e.id}>
                                <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                                    <span className="font-medium text-sm">
                                        {e.students?.profile ? `${e.students.profile.first_name} ${e.students.profile.last_name}` : e.students?.student_number}
                                    </span>
                                    <div className="flex gap-1 flex-wrap">
                                        {STATUSES.map((s) => (
                                            <button
                                                key={s}
                                                onClick={() => setStatuses((prev) => ({ ...prev, [e.student_id]: s }))}
                                                className={cn(
                                                    'text-xs px-2 py-1 rounded-md border transition-colors',
                                                    statuses[e.student_id] === s ? STATUS_COLORS[s] : 'border-transparent text-muted-foreground hover:bg-muted'
                                                )}
                                            >
                                                {t(s)}
                                            </button>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Button onClick={handleSave} disabled={saving || roster.length === 0} className="gradient-blue text-white border-0">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Save className="h-4 w-4 me-2" />}
                        {t('save')}
                    </Button>
                </>
            )}
        </div>
    )
}
