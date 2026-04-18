'use client'

import { useStudentCourses } from '@/hooks/useStudentDashboard'
import { BookOpen, Loader2, AlertCircle, User } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function StudentCoursesPage() {
  const { courses, isLoading, error } = useStudentCourses()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading courses</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Courses</h1>
        <p className="text-muted-foreground mt-1">Subjects you are enrolled in this academic year</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Enrolled Subjects
            <Badge variant="outline" className="ml-2">{courses.length} courses</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No courses found for this academic year</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {courses.map(c => (
                <div key={c.subject_id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0 mt-0.5">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{c.subject_name}</p>
                        <Badge variant="outline" className="text-xs">{c.subject_code}</Badge>
                      </div>
                      {c.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{c.teacher_name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
