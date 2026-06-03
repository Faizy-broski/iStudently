'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { TrendingDown, Building2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { useCampus } from '@/context/CampusContext'
import { getAcademicYears, AcademicYear } from '@/lib/api/academics'
import { WithdrawalChart } from '@/components/analytics/WithdrawalChart'

export default function WithdrawalChartPage() {
  const t = useTranslations('withdrawal')
  const tCommon = useTranslations('common')
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAcademicYears(true)
      .then((years) => setAcademicYears(years.filter((y) => y.is_active)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/admin/students" className="hover:text-foreground">
              {tCommon('students')}
            </Link>
            <span className="rtl:rotate-180">/</span>
            <span>{t('chartTitle')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#022172] dark:text-white flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-red-500" />
            {t('chartTitle')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('chartSubtitle')}</p>
        </div>

        {selectedCampus && (
          <Badge variant="outline" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {selectedCampus.name}
          </Badge>
        )}
      </div>

      {/* Chart */}
      <WithdrawalChart
        academicYears={academicYears}
        campusId={selectedCampus?.id}
      />
    </div>
  )
}
