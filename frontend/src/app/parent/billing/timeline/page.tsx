'use client'

import { usePaymentHistory } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslations } from 'next-intl'
import { useSchoolSettings } from '@/hooks/useSchoolSettings'
import { FeePaymentTimeline } from '@/components/shared/FeePaymentTimeline'

export default function ParentPaymentTimelinePage() {
  const { selectedStudent } = useParentDashboard()
  const { fees, isLoading, error } = usePaymentHistory()
  const { currencySymbol } = useSchoolSettings()
  const t = useTranslations('student_billing.timeline')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('page_title')}</h1>
        <p className="text-muted-foreground mt-1">{t('page_subtitle')}</p>
      </div>

      {!selectedStudent ? (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('select_student')}</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">{t('error_loading')}</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <FeePaymentTimeline fees={fees} currencySymbol={currencySymbol} invoicesHref="/parent/billing/fees" />
      )}
    </div>
  )
}
