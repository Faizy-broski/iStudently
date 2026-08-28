'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowLeft } from 'lucide-react'
import { InspectionReportView } from '@/components/inspections/InspectionReportView'

export default function AdminSignReportPage() {
  const t = useTranslations('inspections.reports')
  const params = useParams()
  const reportId = params?.reportId as string

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link href="/admin/inspections/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> {t('back_to_reports')}
      </Link>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{t('page_title')}</h1>
      </div>
      {reportId && <InspectionReportView reportId={reportId} />}
    </div>
  )
}
