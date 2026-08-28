'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Building2, FileText, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getSupervisorOverview, type FinaSupervisorOverview } from '@/lib/api/fina-supervisor'

export default function FinaSupervisorDashboardPage() {
  const t = useTranslations('fina.supervisor')
  const [overview, setOverview] = useState<FinaSupervisorOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getSupervisorOverview().then((res) => {
      if (cancelled) return
      if (res.error) setError(res.error)
      else setOverview(res.data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('dashboard_subtitle')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-600 py-6">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Building2 className="h-3.5 w-3.5" />{t('stat_schools_active')}</div>
                <div className="text-2xl font-bold text-gray-900">{overview.schoolsActive}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><Building2 className="h-3.5 w-3.5" />{t('stat_schools_total')}</div>
                <div className="text-2xl font-bold text-gray-900">{overview.schoolsTotal}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><FileText className="h-3.5 w-3.5" />{t('stat_posts_this_month')}</div>
                <div className="text-2xl font-bold text-gray-900">{overview.postsThisMonth}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><ShieldCheck className="h-3.5 w-3.5" />{t('stat_consent_coverage')}</div>
                <div className="text-2xl font-bold text-gray-900">{overview.consentCoverage}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1"><AlertTriangle className="h-3.5 w-3.5" />{t('stat_open_alerts')}</div>
                <div className="text-2xl font-bold text-gray-900">{overview.openAlerts}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('schools_table_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.schools.length === 0 ? (
                <p className="text-sm text-gray-500 py-6">{t('empty')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('col_school')}</TableHead>
                      <TableHead>{t('col_consent_coverage')}</TableHead>
                      <TableHead>{t('col_blocked_this_week')}</TableHead>
                      <TableHead>{t('col_status')}</TableHead>
                      <TableHead>{t('col_alert')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.schools.map((school) => (
                      <TableRow key={school.id}>
                        <TableCell className="font-medium text-gray-900">{school.name}</TableCell>
                        <TableCell>{school.consentCoverage}%</TableCell>
                        <TableCell>{school.blockedThisWeek}</TableCell>
                        <TableCell>
                          <Badge variant={school.isActive ? 'default' : 'secondary'}>
                            {school.isActive ? t('status_active') : t('status_inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {school.alert ? (
                            <Badge variant="destructive">{t(`alert_${school.alert}`)}</Badge>
                          ) : (
                            <span className="text-gray-400">{t('alert_none')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
