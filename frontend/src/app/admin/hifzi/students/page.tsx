'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { UserPlus, Users, RefreshCw, LogOut, BookOpen, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCircles, getEnrollments, withdrawEnrollment, type HifziCircle, type HifziEnrollment } from '@/lib/api/hifzi'
import { EnrollStudentDialog } from '@/components/admin/hifzi/EnrollStudentDialog'
import { BulkEnrollStudentsDialog } from '@/components/admin/hifzi/BulkEnrollStudentsDialog'
import { useCampus } from '@/context/CampusContext'
import { toast } from 'sonner'

function HifziStudentsContent() {
    const t = useTranslations('hifzi.students')
    const tc = useTranslations('hifzi.circles')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const searchParams = useSearchParams()
    const initialCircleId = searchParams.get('circle_id') || ''
    const campusContext = useCampus()
    const campusId = campusContext?.selectedCampus?.id

    const [circles, setCircles] = useState<HifziCircle[]>([])
    const [circlesLoaded, setCirclesLoaded] = useState(false)
    const [selectedCircleId, setSelectedCircleId] = useState(initialCircleId)
    const [enrollments, setEnrollments] = useState<HifziEnrollment[]>([])
    const [loading, setLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false)

    useEffect(() => {
        getCircles(campusId).then((res) => {
            if (res.success && res.data) {
                setCircles(res.data)
                if (!selectedCircleId && res.data.length > 0) setSelectedCircleId(res.data[0].id)
            } else if (!res.success) {
                toast.error(`Failed to load circles: ${res.error || 'unknown error'}`)
            }
            setCirclesLoaded(true)
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [campusId])

    const fetchEnrollments = useCallback(async () => {
        if (!selectedCircleId) return
        setLoading(true)
        const res = await getEnrollments(selectedCircleId, campusId)
        if (res.success && res.data) setEnrollments(res.data)
        else if (!res.success) toast.error(`Failed to load students: ${res.error || 'unknown error'}`)
        setLoading(false)
    }, [selectedCircleId, campusId])

    useEffect(() => { fetchEnrollments() }, [fetchEnrollments])

    const handleWithdraw = async (enrollmentId: string) => {
        const res = await withdrawEnrollment(enrollmentId, campusId)
        if (res.success) {
            toast.success(t('withdraw'))
            fetchEnrollments()
        } else {
            toast.error(res.error || 'Failed')
        }
    }

    return (
        <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('title')}
                </h1>
                {circles.length > 0 && (
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedCircleId}
                            onChange={(e) => setSelectedCircleId(e.target.value)}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {circles.map((c) => (
                                <option key={c.id} value={c.id}>{c.name_ar}</option>
                            ))}
                        </select>
                        <Button variant="outline" size="sm" onClick={fetchEnrollments} disabled={loading}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            className="gradient-blue text-white border-0 gap-2"
                            onClick={() => setDialogOpen(true)}
                            disabled={!selectedCircleId}
                        >
                            <UserPlus className="h-4 w-4" />
                            {t('enroll')}
                        </Button>
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => setBulkDialogOpen(true)}
                            disabled={!selectedCircleId}
                        >
                            <Users className="h-4 w-4" />
                            Bulk Enroll
                        </Button>
                    </div>
                )}
            </div>

            {!circlesLoaded ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
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
                <Card>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                        ) : enrollments.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-12">{t('noStudents')}</p>
                        ) : (
                            <table className="w-full text-sm">
                                <tbody className="divide-y">
                                    {enrollments.map((e) => (
                                        <tr key={e.id}>
                                            <td className="px-4 py-3">
                                                {e.students?.profile ? `${e.students.profile.first_name} ${e.students.profile.last_name}` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">{e.students?.student_number}</td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleWithdraw(e.id)}>
                                                    <LogOut className="h-3.5 w-3.5 me-1" />
                                                    {t('withdraw')}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            )}

            {selectedCircleId && (
                <>
                    <EnrollStudentDialog
                        open={dialogOpen}
                        onOpenChange={setDialogOpen}
                        circleId={selectedCircleId}
                        onEnrolled={fetchEnrollments}
                        campusId={campusId}
                    />
                    <BulkEnrollStudentsDialog
                        open={bulkDialogOpen}
                        onOpenChange={setBulkDialogOpen}
                        circleId={selectedCircleId}
                        onEnrolled={fetchEnrollments}
                        campusId={campusId}
                    />
                </>
            )}
        </div>
    )
}

export default function HifziStudentsPage() {
    return (
        <Suspense fallback={null}>
            <HifziStudentsContent />
        </Suspense>
    )
}
