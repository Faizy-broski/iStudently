'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { getQuizzes, getAnswerBreakdown, QUESTION_TYPE_LABELS, type AnswerBreakdownRow } from '@/lib/api/quiz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { BarChart2, TrendingDown } from 'lucide-react'

function getDifficultyColor(pct: number) {
  if (pct >= 75) return '#22c55e'   // green
  if (pct >= 50) return '#f59e0b'   // amber
  return '#ef4444'                  // red
}

function DifficultyBadge({ pct }: { pct: number }) {
  if (pct >= 75) return <Badge className="bg-green-100 text-green-800">Easy</Badge>
  if (pct >= 50) return <Badge className="bg-amber-100 text-amber-800">Medium</Badge>
  return <Badge className="bg-red-100 text-red-800">Hard</Badge>
}

export default function AnswerBreakdownPage() {
  const { profile } = useAuth()
  const { selectedCampus } = useCampus()
  const schoolId = profile?.school_id ?? ''
  const campusId = selectedCampus?.id ?? null
  const searchParams = useSearchParams()
  const [quizId, setQuizId] = useState(searchParams.get('quiz_id') ?? '')

  const { data: quizzes } = useSWR(
    schoolId ? ['quiz-quizzes-list', schoolId, campusId] : null,
    () => getQuizzes(schoolId, { campusId }).then(r => r.data ?? [])
  )

  const { data: breakdown, isLoading } = useSWR(
    quizId ? ['quiz-breakdown', quizId] : null,
    () => getAnswerBreakdown(quizId).then(r => r.data ?? [])
  )

  const difficult = (breakdown ?? []).filter(r => r.correct_pct < 50)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Answer Breakdown</h1>
        <Badge variant="secondary" className="ml-1">Premium</Badge>
      </div>

      <div className="max-w-sm space-y-1">
        <Label>Select Quiz</Label>
        <Select value={quizId || '__none__'} onValueChange={v => setQuizId(v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Choose a quiz…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Select a quiz —</SelectItem>
            {(quizzes ?? []).map(q => (
              <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!quizId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Select a quiz above to view the answer breakdown.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (breakdown ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No student answers found for this quiz yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Questions</p>
                <p className="text-2xl font-bold">{breakdown!.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Avg Correct</p>
                <p className="text-2xl font-bold">
                  {Math.round((breakdown ?? []).reduce((s, r) => s + r.correct_pct, 0) / (breakdown?.length || 1))}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Hard Questions</p>
                <p className="text-2xl font-bold text-red-600">{difficult.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm text-muted-foreground">Total Responses</p>
                <p className="text-2xl font-bold">{breakdown?.[0]?.total_answers ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Correct Answer % per Question</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={breakdown} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="question_title"
                    tick={{ fontSize: 11 }}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    formatter={(val: number) => [`${val}%`, 'Correct']}
                    labelFormatter={label => `Q: ${label}`}
                  />
                  <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: '50%', position: 'right', fontSize: 11 }} />
                  <Bar dataKey="correct_pct" radius={[4, 4, 0, 0]}>
                    {(breakdown ?? []).map(row => (
                      <Cell key={row.map_id} fill={getDifficultyColor(row.correct_pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Question Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-3">Question</th>
                    <th className="text-left p-3">Type</th>
                    <th className="text-right p-3">Responses</th>
                    <th className="text-right p-3">Correct</th>
                    <th className="text-right p-3">Avg Points</th>
                    <th className="text-right p-3">Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {(breakdown ?? []).map(row => (
                    <tr key={row.map_id} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium max-w-xs truncate">{row.question_title}</td>
                      <td className="p-3 text-muted-foreground">{QUESTION_TYPE_LABELS[row.question_type]}</td>
                      <td className="p-3 text-right">{row.total_answers}</td>
                      <td className="p-3 text-right">{row.correct_pct}%</td>
                      <td className="p-3 text-right">{row.avg_points} / {row.total_points}</td>
                      <td className="p-3 text-right"><DifficultyBadge pct={row.correct_pct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Hard Questions Alert */}
          {difficult.length > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-700 text-base">
                  <TrendingDown className="w-4 h-4" />
                  Questions Students Struggled With
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {difficult.map(row => (
                  <div key={row.map_id} className="flex items-center justify-between text-sm">
                    <span className="text-red-800 font-medium">{row.question_title}</span>
                    <span className="text-red-600">{row.correct_pct}% correct</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
