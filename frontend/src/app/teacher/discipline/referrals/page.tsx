'use client'

import useSWR from 'swr'
import { getStaffDisciplineReferrals, type DisciplineReferral } from '@/lib/api/discipline'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function TeacherDisciplineReferralsPage() {
  const { data: referralsRes, isLoading } = useSWR(
    'teacher-referrals-logs',
    () => getStaffDisciplineReferrals(),
    { revalidateOnFocus: false }
  )

  const referrals: DisciplineReferral[] = referralsRes?.data || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Discipline Referrals</h1>
        <p className="text-muted-foreground mt-1">View the discipline referrals you have submitted.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">You have not submitted any discipline referrals.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {referrals.map(ref => <ReferralCard key={ref.id} referral={ref} />)}
        </div>
      )}
    </div>
  )
}

function ReferralCard({ referral }: { referral: DisciplineReferral }) {
  const student = (referral as any).students
  const studentName = student
    ? `${student.last_name || ''}, ${student.first_name || ''}`.trim()
    : 'Unknown Student'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{studentName}</p>
              <p className="text-sm text-muted-foreground">
                Incident Date: {format(parseISO(referral.incident_date), 'MMMM d, yyyy')}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">Reported by You</Badge>
        </div>
        {referral.field_values && Object.keys(referral.field_values).length > 0 && (
          <div className="mt-3 text-sm text-muted-foreground border-t pt-2 space-y-1">
            {Object.entries(referral.field_values as Record<string, any>).map(([k, v]) => (
              <div key={k}><span className="font-medium capitalize">{k.replace(/_/g, ' ')}: </span>{String(v)}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
