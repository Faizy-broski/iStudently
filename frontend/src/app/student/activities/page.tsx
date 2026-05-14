'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { getStudentActivities } from '@/lib/api/student-dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Star, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function StudentActivitiesPage() {
  const { user } = useAuth()

  const { data, isLoading } = useSWR(
    user ? ['student-activities', user.id] : null,
    () => getStudentActivities(),
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  const enrollments = data?.data || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Activities</h1>
        <p className="text-muted-foreground mt-1">Activities and extracurriculars you are enrolled in</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Star className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-semibold">No Activities</p>
            <p className="text-muted-foreground mt-1">You are not enrolled in any activities yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enrollments.map((enrollment: any) => {
            const activity = enrollment.activity
            if (!activity) return null
            return (
              <Card key={enrollment.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      {activity.title}
                    </CardTitle>
                    <Badge variant={activity.is_active ? 'default' : 'secondary'}>
                      {activity.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {(activity.start_date || activity.end_date) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {activity.start_date && format(parseISO(activity.start_date), 'MMM d, yyyy')}
                      {activity.start_date && activity.end_date && ' – '}
                      {activity.end_date && format(parseISO(activity.end_date), 'MMM d, yyyy')}
                    </div>
                  )}
                  {activity.comment && (
                    <p className="text-sm text-muted-foreground">{activity.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Enrolled {format(parseISO(enrollment.created_at), 'MMM d, yyyy')}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
