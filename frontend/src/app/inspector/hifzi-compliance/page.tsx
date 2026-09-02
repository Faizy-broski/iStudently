'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, Users, TrendingUp, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getInspectorComplianceDashboard, type HifziComplianceDashboardStats } from '@/lib/api/hifzi'
import { getCurrentAcademicYear, type AcademicYear } from '@/lib/api/academics'
import { SyllabusCompletionHeatmap } from '@/components/hifzi/SyllabusCompletionHeatmap'

// Ministerial Decree 1205 compliance, Phase 3 — the ministry-inspector
// counterpart to /inspector/dashboard (teacher-performance evaluation,
// unrelated module): syllabus-completion % across every school this
// inspector holds a 'hifzi_compliance'-program grant for
// (inspector_school_assignments), rolled up by school.
export default function InspectorHifziCompliancePage() {
    const t = useTranslations('hifzi.compliance')
    const locale = useLocale()
    const isAr = locale === 'ar'

    const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null)
    const [stats, setStats] = useState<HifziComplianceDashboardStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        getCurrentAcademicYear().then((year) => {
            setAcademicYear(year)
            if (!year) {
                setLoading(false)
                return
            }
            getInspectorComplianceDashboard(year.id).then((res) => {
                if (res.success && res.data) setStats(res.data)
                else setError(res.error || t('loadError'))
                setLoading(false)
            })
        })
    }, [t])

    return (
        <div className="p-4 sm:p-6 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('inspectorTitle')}</h1>
                <p className="text-sm text-gray-500 mt-1">{t('inspectorSubtitle')}</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !academicYear ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('noAcademicYear')}</p>
            ) : error ? (
                <p className="text-sm text-red-600 text-center py-8">{error}</p>
            ) : stats && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                        <Card>
                            <CardContent className="pt-5">
                                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><BookOpen className="h-3.5 w-3.5" />{t('schoolsCovered')}</div>
                                <div className="text-2xl font-bold text-gray-900">{stats.heatmap.length}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">{t('completionBySchool')}</CardTitle>
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
