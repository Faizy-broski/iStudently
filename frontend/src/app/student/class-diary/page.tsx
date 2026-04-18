'use client'

import useSWR from 'swr'
import { getStudentClassDiary } from '@/lib/api/student-dashboard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function StudentClassDiaryPage() {
  const { data: res, isLoading } = useSWR(
    'student-class-diary',
    () => getStudentClassDiary(),
    { revalidateOnFocus: false }
  )

  const entries: any[] = (res as any)?.data || []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Class Diary</h1>
        <p className="text-muted-foreground mt-1">Daily notes and activities from your teacher</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium text-muted-foreground">No diary entries yet</p>
            <p className="text-sm text-muted-foreground mt-1">Your teacher hasn't posted any entries for your class</p>
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
  )
}
