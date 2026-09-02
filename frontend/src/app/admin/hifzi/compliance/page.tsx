'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Users, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSchoolComplianceDashboard, type HifziComplianceDashboardStats } from '@/lib/api/hifzi'
import { getCurrentAcademicYear, type AcademicYear } from '@/lib/api/academics'
import { SyllabusCompletionHeatmap } from '@/components/hifzi/SyllabusCompletionHeatmap'
import { useCampus } from '@/context/CampusContext'
import { useAuth } from '@/context/AuthContext'

// Ministerial Decree 1205 compliance, Phase 3 — the school-level (admin)
// counterpart to the inspector's cross-school dashboard: syllabus-completion
// % for this campus, rolled up per circle.
export default function AdminHifziCompliancePage() {
    const t = useTranslations('hifzi.compliance')
    const locale = useLocale()
    const isAr = locale === 'ar'
    const campusContext = useCampus()
    const { profile } = useAuth()
    const schoolId = campusContext?.selectedCampus?.id || profile?.school_id

    const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
    const [stats, setStats] = useState<HifziComplianceDashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!schoolId) return
        setLoading(true)
        getCurrentAcademicYear().then((year) => {
            setAcademicYear(year)
            if (!year) {
                setLoading(false)
                return
            }
            getSchoolComplianceDashboard(schoolId, year.id, campusContext?.selectedCampus?.id).then((res) => {
                if (res.success && res.data) setStats(res.data)
                else setError(res.error || t('loadError'))
                setLoading(false)
            })
        })
    }, [schoolId, campusContext?.selectedCampus?.id, t])

    return (
        <div className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent">
                    {t('title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : !academicYear ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('noAcademicYear')}</p>
            ) : error ? (
                <p className="text-sm text-red-600 text-center py-8">{error}</p>
            ) : stats && (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <Card>
                            <CardContent className="pt-5">
                                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Users className="h-3.5 w-3.5" />{t('studentsTracked')}</div>
                                <div className="text-2xl font-bold text-gray-900">{stats.studentsTracked}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-5">
                                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><TrendingUp className="h-3.5 w-3.5" />{t('avgCompletion')}</div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {stats.avgCompletionPercent !== null ? `${stats.avgCompletionPercent.toFixed(1)}%` : '—'}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('completionByCircle')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SyllabusCompletionHeatmap rows={stats.heatmap} emptyLabel={t('noData')} />
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
