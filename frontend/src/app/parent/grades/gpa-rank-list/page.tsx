'use client'

import { useGpaRank } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { TrendingUp, Loader2, AlertCircle, Award, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const GPA_SCALE = [
  { range: '93–100', letter: 'A', gpa: '4.0' },
  { range: '90–92', letter: 'A-', gpa: '3.7' },
  { range: '87–89', letter: 'B+', gpa: '3.3' },
  { range: '83–86', letter: 'B', gpa: '3.0' },
  { range: '80–82', letter: 'B-', gpa: '2.7' },
  { range: '77–79', letter: 'C+', gpa: '2.3' },
  { range: '73–76', letter: 'C', gpa: '2.0' },
  { range: '70–72', letter: 'C-', gpa: '1.7' },
  { range: '60–69', letter: 'D', gpa: '1.0' },
  { range: 'Below 60', letter: 'F', gpa: '0.0' },
]

export default function ParentGpaRankPage() {
  const { selectedStudent } = useParentDashboard()
  const { gpaRank, isLoading, error } = useGpaRank()

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading GPA data</h3>
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
        <h1 className="text-3xl font-bold">GPA / Class Rank</h1>
        <p className="text-muted-foreground mt-1">Grade point average and class standing</p>
      </div>

      {!gpaRank || gpaRank.gpa === null ? (
        <Card>
          <CardContent className="text-center py-12">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No GPA data available yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Award className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">GPA (4.0 Scale)</p>
              <p className="text-4xl font-bold mt-1 text-primary">{gpaRank.gpa?.toFixed(2) ?? '—'}</p>
              {gpaRank.grade && <Badge className="mt-2">{gpaRank.grade}</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="text-sm text-muted-foreground">Class Rank</p>
              <p className="text-4xl font-bold mt-1 text-blue-600">
                {gpaRank.rank !== null ? `#${gpaRank.rank}` : '—'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Class Size</p>
              <p className="text-4xl font-bold mt-1">{gpaRank.total_students ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">Percentile Average</p>
              <p className="text-4xl font-bold mt-1 text-green-600">
                {gpaRank.percentage !== null ? `${gpaRank.percentage.toFixed(1)}%` : '—'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> GPA Scale Reference</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-xs text-muted-foreground uppercase">
                  <th className="text-left py-2 pr-4 font-semibold">Percentage</th>
                  <th className="text-center py-2 pr-4 font-semibold">Letter Grade</th>
                  <th className="text-center py-2 font-semibold">GPA Points</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {GPA_SCALE.map(row => (
                  <tr key={row.letter} className="hover:bg-accent/30">
                    <td className="py-2 pr-4">{row.range}</td>
                    <td className="py-2 pr-4 text-center font-semibold">{row.letter}</td>
                    <td className="py-2 text-center">{row.gpa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
