'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Loader2, UserCog, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useCampus } from '@/context/CampusContext'
import { listReportsForSchool, type InspectionReport } from '@/lib/api/inspection-report'

type Row = InspectionReport & {
  teacher: { id: string; first_name: string; last_name: string }
  inspector: { id: string; first_name: string; last_name: string }
}

export default function AdminReportsPage() {
  const t = useTranslations('inspections.reports')
  const campusCtx = useCampus()
  const schoolId = campusCtx?.selectedCampus?.id

  const [reports, setReports] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!schoolId) return
    setLoading(true)
    listReportsForSchool(schoolId).then((res) => {
      setReports(res.data || [])
      setLoading(false)
    })
  }, [schoolId])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('list_page_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin_list_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {!schoolId ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('select_campus_prompt')}</p>
          ) : loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-12">{t('no_reports')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((r) => (
                <Link key={r.id} href={`/admin/inspections/reports/${r.id}/sign`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                      <UserCog className="h-4 w-4 text-[#022172]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.teacher.first_name} {r.teacher.last_name}</div>
                      <div className="text-xs text-gray-500">{t('inspector_prefix')} {r.inspector.first_name} {r.inspector.last_name}</div>
                    </div>
                  </div>
                  <Badge variant={r.status === 'fully_signed' ? 'secondary' : 'outline'} className="gap-1">
                    <FileText className="h-3 w-3" />
                    {t(`status_${r.status}`)}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
