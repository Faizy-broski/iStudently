'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getStudentDiscipline } from '@/lib/api/student-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function StudentDisciplinePage() {
  const { user } = useAuth()

  const { data, isLoading } = useSWR(
    user ? ['student-discipline', user.id] : null,
    () => getStudentDiscipline(),
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  const referrals = data?.data || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Discipline Record</h1>
        <p className="text-muted-foreground mt-1">View your discipline referrals and conduct history</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="text-lg font-semibold">Clean Record</p>
            <p className="text-muted-foreground mt-1">You have no discipline referrals on record.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{referrals.length} referral{referrals.length !== 1 ? 's' : ''} on record</p>
          <div className="space-y-3">
            {referrals.map((ref: any) => (
              <ReferralCard key={ref.id} referral={ref} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ReferralCard({ referral }: { referral: any }) {
  const reporter = referral.reporter?.profile
  const reporterName = reporter
    ? `${reporter.first_name} ${reporter.last_name}`
    : 'Staff'

  const fieldValues: Record<string, any> = referral.field_values || {}
  const hasFields = Object.keys(fieldValues).length > 0

  return (
    <Card className="border-l-4 border-l-orange-400">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            Referral — {format(parseISO(referral.incident_date), 'MMMM d, yyyy')}
          </CardTitle>
          <Badge variant="outline" className="text-xs">Reported by {reporterName}</Badge>
        </div>
      </CardHeader>
      {hasFields && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(fieldValues).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}: </span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
