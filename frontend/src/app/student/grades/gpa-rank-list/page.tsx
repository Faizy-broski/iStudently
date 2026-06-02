'use client'

import { useStudentGpaRank } from '@/hooks/useStudentDashboard'
import { TrendingUp, Award, Users, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export default function GpaRankListPage() {
  const { gpaRank, isLoading, error } = useStudentGpaRank()

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading GPA data</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const noData = !gpaRank || gpaRank.gpa === null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">GPA / Class Rank</h1>
        <p className="text-muted-foreground mt-1">Your cumulative GPA and standing in your class</p>
      </div>

      {noData ? (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No grade data available to compute GPA yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Award className="h-12 w-12 text-primary mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Cumulative GPA</p>
              <p className="text-6xl font-bold text-primary">{gpaRank?.gpa?.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground mt-1">out of 4.00</p>
              {gpaRank?.grade && (
                <Badge className="mt-3 text-base px-4 py-1">{gpaRank.grade}</Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Users className="h-8 w-8 text-blue-500 mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Class Rank</p>
              {gpaRank?.rank ? (
                <>
                  <p className="text-4xl font-bold">#{gpaRank.rank}</p>
                  <p className="text-xs text-muted-foreground mt-1">of {gpaRank.total_students} students</p>
                </>
              ) : (
                <p className="text-muted-foreground">N/A</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <TrendingUp className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm text-muted-foreground mb-1">Overall %</p>
              <p className="text-4xl font-bold">{gpaRank?.percentage}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!noData && gpaRank?.percentage != null && (
        <Card>
          <CardHeader>
            <CardTitle>Grade Distribution Scale</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'A (93–100%)', min: 93, gpa: '4.0' },
                { label: 'A- (90–92%)', min: 90, gpa: '3.7' },
                { label: 'B+ (87–89%)', min: 87, gpa: '3.3' },
                { label: 'B (83–86%)', min: 83, gpa: '3.0' },
                { label: 'B- (80–82%)', min: 80, gpa: '2.7' },
                { label: 'C+ (77–79%)', min: 77, gpa: '2.3' },
                { label: 'C (73–76%)', min: 73, gpa: '2.0' },
                { label: 'D (60–69%)', min: 60, gpa: '1.0' },
                { label: 'F (< 60%)', min: 0, gpa: '0.0' },
              ].map(row => (
                <div key={row.label} className={`flex items-center justify-between p-2 rounded text-sm ${(gpaRank.percentage || 0) >= row.min && (row.min === 0 || (gpaRank.percentage || 0) < (row.min + 10)) ? 'bg-primary/10 font-semibold' : ''}`}>
                  <span>{row.label}</span>
                  <span className="text-muted-foreground">GPA {row.gpa}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
