'use client'

import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { getStudentClassDiary } from '@/lib/api/parent-dashboard'
import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Loader2, MessageSquare } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function ParentClassDiaryPage() {
  const { user, profile } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const { data, isLoading } = useSWR(
    user && profile?.role === 'parent' && selectedStudent
      ? ['parent-class-diary', selectedStudent]
      : null,
    () => getStudentClassDiary(selectedStudent!),
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  const entries: any[] = Array.isArray(data) ? data : []

  return (
    <ParentDashboardLayout hideStats={true}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Class Diary</h1>
          <p className="text-muted-foreground mt-1">Daily notes and activities from your child's teacher</p>
        </div>

        {!selectedStudent ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Select a student to view their class diary</p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-medium text-muted-foreground">No diary entries yet</p>
              <p className="text-sm text-muted-foreground mt-1">Your child's teacher hasn't posted any entries</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {entries.map((entry: any) => {
              const teacherProfile = entry.teacher?.profile
              const teacherName = teacherProfile
                ? `${teacherProfile.first_name} ${teacherProfile.last_name}`
                : 'Teacher'

              return (
                <Card key={entry.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="font-semibold">
                            {format(parseISO(entry.diary_date), 'EEEE, MMMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">By {teacherName}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {entry.is_published && (
                          <Badge variant="outline" className="text-xs">Published</Badge>
                        )}
                        {entry.enable_comments && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <MessageSquare className="h-3 w-3" /> Comments on
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {entry.content}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {!isLoading && entries.length > 0 && (
          <p className="text-xs text-center text-muted-foreground">
            Showing {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
          </p>
        )}
      </div>
    </ParentDashboardLayout>
  )
}
