'use client'

import { useReportCard } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { GraduationCap, Loader2, AlertCircle, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

export default function ParentTranscriptsPage() {
  const { selectedStudent } = useParentDashboard()
  const { reportCard, isLoading, error } = useReportCard()

  if (!selectedStudent) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please select a student from the dashboard</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading transcript</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Transcripts</h1>
          <p className="text-muted-foreground mt-1">Official academic transcript</p>
        </div>
        {reportCard && (
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        )}
      </div>

      {!reportCard ? (
        <Card>
          <CardContent className="text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No transcript data available</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5" /> Student Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground">Name</p><p className="font-semibold">{reportCard.student.name}</p></div>
              <div><p className="text-muted-foreground">Student No.</p><p className="font-semibold">{reportCard.student.student_number}</p></div>
              <div><p className="text-muted-foreground">Grade / Section</p><p className="font-semibold">{reportCard.student.grade_level} — {reportCard.student.section}</p></div>
              <div>
                <p className="text-muted-foreground">Generated</p>
                <p className="font-semibold">{format(parseISO(reportCard.generated_at), 'MMM d, yyyy')}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Academic Record</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-xs text-muted-foreground uppercase">
                      <th className="text-left py-3 pr-4 font-semibold">Subject</th>
                      <th className="text-right py-3 pr-4 font-semibold">Marks</th>
                      <th className="text-right py-3 pr-4 font-semibold">Total</th>
                      <th className="text-right py-3 pr-4 font-semibold">Percentage</th>
                      <th className="text-center py-3 font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {reportCard.subjects.map((s, i) => (
                      <tr key={i}>
                        <td className="py-3 pr-4 font-medium">{s.subject}</td>
                        <td className="py-3 pr-4 text-right">{s.total_obtained}</td>
                        <td className="py-3 pr-4 text-right">{s.total_possible}</td>
                        <td className="py-3 pr-4 text-right">{s.percentage.toFixed(1)}%</td>
                        <td className="py-3 text-center"><Badge variant="outline">{s.grade}</Badge></td>
                      </tr>
                    ))}
                    <tr className="font-bold border-t-2 bg-muted/20">
                      <td className="py-3 pr-4">Cumulative</td>
                      <td className="py-3 pr-4 text-right">{reportCard.overall.total_obtained}</td>
                      <td className="py-3 pr-4 text-right">{reportCard.overall.total_possible}</td>
                      <td className="py-3 pr-4 text-right">{reportCard.overall.percentage.toFixed(1)}%</td>
                      <td className="py-3 text-center"><Badge>{reportCard.overall.grade}</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
