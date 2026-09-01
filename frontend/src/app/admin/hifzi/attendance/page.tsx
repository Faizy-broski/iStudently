'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Save, CheckCheck, BookOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCircles, getEnrollments, getAttendance, markAttendanceBulk, type HifziCircle, type HifziEnrollment } from '@/lib/api/hifzi'
import { useCampus } from '@/context/CampusContext'
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

// Admin view of the same mark-attendance flow as the teacher page
// (frontend/src/app/teacher/hifzi/attendance/page.tsx) — kept as a
// deliberate near-duplicate rather than a shared component, matching how
// this codebase already mirrors library/attendance pages per role rather
// than building one role-parameterized page (see admin/library vs
// teacher/library/student/library as separate thin page trees).
export default function AdminHifziAttendancePage() {
    const t = useTranslations('hifzi.attendance')
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
    const [statuses, setStatuses] = useState<Record<string, Status>>({})
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const today = new Date().toISOString().slice(0, 10)
    const [date, setDate] = useState(today)
    const [existingRecord, setExistingRecord] = useState(false)

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

    const fetchRoster = useCallback(async () => {
        if (!circleId || !date) return
        setLoading(true)

        const rosterRes = await getEnrollments(circleId, campusId)
        if (!rosterRes.success || !rosterRes.data) {
            toast.error(`Failed to load roster: ${rosterRes.error || 'unknown error'}`)
            setLoading(false)
            return
        }
        setRoster(rosterRes.data)

        // Defaults: everyone present, then overlay whatever was already
        // recorded for this circle+date so re-opening a past date edits the
        // real saved statuses instead of silently resetting everyone to
        // "present".
        const defaults = Object.fromEntries(rosterRes.data.map((e) => [e.student_id, 'present' as Status]))
        const attendanceRes = await getAttendance(circleId, date, campusId)
        if (attendanceRes.success && attendanceRes.data) {
            const records = attendanceRes.data as Array<{ student_id: string; status: Status }>
            setExistingRecord(records.length > 0)
            for (const r of records) defaults[r.student_id] = r.status
        } else {
            setExistingRecord(false)
        }
        setStatuses(defaults)

        setLoading(false)
    }, [circleId, date, campusId])

    useEffect(() => { fetchRoster() }, [fetchRoster])

    const markAllPresent = () => setStatuses(Object.fromEntries(roster.map((e) => [e.student_id, 'present' as Status])))

    const handleSave = async () => {
        setSaving(true)
        const res = await markAttendanceBulk(circleId, date, roster.map((e) => ({ student_id: e.student_id, status: statuses[e.student_id] })), campusId)
        if (res.success) {
            toast.success(t('save'))
            setExistingRecord(true)
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
                    <div className="flex items-center gap-2">
                        <select value={circleId} onChange={(e) => setCircleId(e.target.value)} className="h-10 rounded-md border px-3 text-sm">
                            {circles.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                        </select>
                        <input
                            type="date"
                            value={date}
                            max={today}
                            onChange={(e) => setDate(e.target.value)}
                            className="h-10 rounded-md border px-3 text-sm"
                        />
                    </div>
                )}
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
            ) : loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {ts('noStudents')}{' '}
                    <Link href={`/admin/hifzi/students?circle_id=${circleId}`} className="underline text-primary">
                        {ts('enroll')}
                    </Link>
                </p>
            ) : (
                <>
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button variant="outline" size="sm" onClick={markAllPresent}>
                            <CheckCheck className="h-4 w-4 me-1" />
                            {t('markAll')}
                        </Button>
                        {existingRecord && (
                            <span className="text-xs text-muted-foreground">{t('alreadyRecorded')}</span>
                        )}
                    </div>

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
