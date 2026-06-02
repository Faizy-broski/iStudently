'use client'

import { useWeeklyTimetable } from '@/hooks/useStudentDashboard'
import { FileText, Loader2, AlertCircle, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function formatTime(t?: string) {
  if (!t) return '—'
  return t.slice(0, 5)
}

export default function PrintSchedulesPage() {
  const { timetable, isLoading, error } = useWeeklyTimetable()

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading schedule</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Group timetable by day
  const byDay = new Map<number, typeof timetable>()
  for (const entry of timetable) {
    const day = entry.day_of_week
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(entry)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Print Schedules</h1>
          <p className="text-muted-foreground mt-1">Your weekly class schedule</p>
        </div>
        <Button onClick={() => window.print()} variant="outline" className="gap-2 print:hidden">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timetable.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No schedule data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(byDay.entries())
                .sort(([a], [b]) => a - b)
                .map(([dayNum, entries]) => (
                  <div key={dayNum}>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                      {DAYS[dayNum - 1] || `Day ${dayNum}`}
                    </h3>
                    <div className="space-y-1">
                      {entries
                        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                        .map(e => (
                          <div key={e.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card text-sm">
                            <span className="text-muted-foreground w-32 shrink-0">
                              {formatTime(e.start_time)} – {formatTime(e.end_time)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{(e.subject as any)?.name || '—'}</span>
                              {(e.subject as any)?.code && (
                                <Badge variant="outline" className="ml-2 text-xs">{(e.subject as any).code}</Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground shrink-0">
                              {(e.teacher as any)?.profile
                                ? `${(e.teacher as any).profile.first_name} ${(e.teacher as any).profile.last_name}`
                                : '—'}
                            </span>
                          </div>
                        ))}
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
