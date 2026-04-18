'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { getStudentDiscipline } from '@/lib/api/parent-dashboard'
import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, CheckCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function ParentDisciplinePage() {
  const { user, profile } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const { data, isLoading } = useSWR(
    user && profile?.role === 'parent' && selectedStudent
      ? ['parent-discipline', selectedStudent]
      : null,
    () => getStudentDiscipline(selectedStudent!),
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  const referrals: any[] = Array.isArray(data) ? data : []

  return (
    <ParentDashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Discipline Record</h2>
          <p className="text-gray-500 mt-1">View your child's conduct and discipline history</p>
        </div>

        {!selectedStudent ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldAlert className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a student to view their discipline record</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : referrals.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p className="text-lg font-semibold">Clean Record</p>
              <p className="text-gray-500 mt-1">No discipline referrals on record.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{referrals.length} referral{referrals.length !== 1 ? 's' : ''} on record</p>
            {referrals.map((ref: any) => {
              const reporter = ref.reporter?.profile
              const reporterName = reporter
                ? `${reporter.first_name} ${reporter.last_name}`
                : 'Staff'
              const fieldValues: Record<string, any> = ref.field_values || {}

              return (
                <Card key={ref.id} className="border-l-4 border-l-orange-400">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-orange-500" />
                        {format(parseISO(ref.incident_date), 'MMMM d, yyyy')}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">By {reporterName}</Badge>
                    </div>
                  </CardHeader>
                  {Object.keys(fieldValues).length > 0 && (
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(fieldValues).map(([k, v]) => (
                          <div key={k} className="text-sm">
                            <span className="font-medium text-gray-500 capitalize">{k.replace(/_/g, ' ')}: </span>
                            <span>{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </ParentDashboardLayout>
  )
}
