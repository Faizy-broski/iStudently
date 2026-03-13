'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, TrendingDown } from 'lucide-react'
import { getStudentDisciplineScore, type DisciplineScoreResult } from '@/lib/api/discipline'
import { format } from 'date-fns'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getScoreColor(score: number): {
  ring: string
  bg: string
  text: string
  label: string
  badgeClass: string
} {
  if (score >= 100) return { ring: 'ring-blue-400', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', label: 'Excellent', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' }
  if (score >= 90)  return { ring: 'ring-green-400', bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-300', label: 'Good', badgeClass: 'bg-green-100 text-green-800 border-green-200' }
  if (score >= 70)  return { ring: 'ring-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-300', label: 'Fair', badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
  if (score >= 50)  return { ring: 'ring-orange-400', bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', label: 'Poor', badgeClass: 'bg-orange-100 text-orange-800 border-orange-200' }
  return { ring: 'ring-red-400', bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', label: 'Critical', badgeClass: 'bg-red-100 text-red-800 border-red-200' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  studentId: string
  campusId?: string | null
  academicYearId?: string | null
}

export default function DisciplineScoreTab({ studentId, campusId, academicYearId }: Props) {
  const [result, setResult] = useState<DisciplineScoreResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    setError(null)
    getStudentDisciplineScore({ studentId, campusId, academicYearId })
      .then((resp) => {
        if (resp.data) {
          setResult(resp.data)
        } else {
          setError(resp.error || 'Failed to load discipline score')
        }
      })
      .catch(() => setError('Failed to load discipline score'))
      .finally(() => setLoading(false))
  }, [studentId, campusId, academicYearId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!result) return null

  const colors = getScoreColor(result.score)

  return (
    <div className="space-y-6">
      {/* Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Discipline Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex flex-col sm:flex-row items-center gap-6 p-6 rounded-xl ${colors.bg}`}>
            {/* Circle score */}
            <div className={`shrink-0 h-32 w-32 rounded-full ring-8 ${colors.ring} flex flex-col items-center justify-center`}>
              <span className={`text-4xl font-bold ${colors.text}`}>{result.score}</span>
              <span className={`text-xs font-medium ${colors.text} opacity-70`}>/ 100</span>
            </div>

            {/* Stats */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Badge variant="outline" className={colors.badgeClass}>{colors.label}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Total penalty:</span>{' '}
                  <span className={result.total_delta < 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                    {result.total_delta < 0 ? result.total_delta : '+0'}
                  </span>
                </p>
                <p>
                  <span className="font-medium">Referrals this period:</span> {result.referral_count}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      {result.breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Penalty Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.field_name}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        try { return format(new Date(item.incident_date), 'MMM d, yyyy') }
                        catch { return item.incident_date }
                      })()}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 bg-red-50 text-red-700 border-red-200 font-mono">
                    {item.delta}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.breakdown.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No penalty events recorded</p>
            <p className="text-sm mt-1">Score remains at full 100 points</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
