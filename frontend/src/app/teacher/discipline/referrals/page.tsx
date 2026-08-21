'use client'

import useSWR from 'swr'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getStaffDisciplineReferrals, getDisciplineFieldNameMap, type DisciplineReferral } from '@/lib/api/discipline'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function TeacherDisciplineReferralsPage() {
  const t = useTranslations('teacherPages.disciplineReferrals')
  const { data: referralsRes, isLoading } = useSWR(
    'teacher-referrals-logs',
    () => getStaffDisciplineReferrals(),
    { revalidateOnFocus: false }
  )

  const referrals: DisciplineReferral[] = referralsRes?.data || []
  const schoolId = referrals[0]?.school_id

  const [fieldNameMap, setFieldNameMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!schoolId) return
    getDisciplineFieldNameMap(schoolId)
      .then(setFieldNameMap)
      .catch(() => {/* silent — labels fall back to raw key */})
  }, [schoolId])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <p className="text-muted-foreground mt-1">{t('pageDescription')}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">{t('noReferralsSubmitted')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map(ref => <ReferralCard key={ref.id} referral={ref} fieldNameMap={fieldNameMap} />)}
        </div>
      )}
    </div>
  )
}

function ReferralCard({ referral, fieldNameMap }: { referral: DisciplineReferral; fieldNameMap: Record<string, string> }) {
  const t = useTranslations('teacherPages.disciplineReferrals')
  const student = (referral as any).students
  const studentName = student
    ? `${student.last_name || ''}, ${student.first_name || ''}`.trim()
    : t('unknownStudent')

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{studentName}</p>
              <p className="text-sm text-muted-foreground">
                {t('incidentDateLabel', { date: format(parseISO(referral.incident_date), 'MMMM d, yyyy') })}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">{t('reportedByYou')}</Badge>
        </div>
        {referral.field_values && Object.keys(referral.field_values).length > 0 && (
          <div className="mt-3 text-sm text-muted-foreground border-t pt-2 space-y-1">
            {Object.entries(referral.field_values as Record<string, any>).map(([k, v]) => (
              <div key={k}><span className="font-medium capitalize">{fieldNameMap[k] || k.replace(/_/g, ' ')}: </span>{String(v)}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
