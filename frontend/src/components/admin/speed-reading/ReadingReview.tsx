'use client'

import { Headphones, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WordResult } from '@/lib/api/speed-reading'

interface ReviewStats {
  correct_words: number
  incorrect_words: number
  accuracy_percentage: number
  target_wpm: number
  points_earned: number
  comprehension_bonus: boolean
}

interface ReadingReviewProps {
  textContent: string
  textLanguage?: string
  wordResults: WordResult[] | null
  audioUrl: string | null
  studentName?: string
  sessionDate?: string
  stats: ReviewStats
}

export function ReadingReview({
  textContent,
  textLanguage,
  wordResults,
  audioUrl,
  studentName,
  sessionDate,
  stats,
}: ReadingReviewProps) {
  const words = textContent.trim().split(/\s+/).filter(Boolean)
  const isRtl = textLanguage === 'ar'

  return (
    <div className="space-y-6">
      {/* Header */}
      {(studentName || sessionDate) && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          {studentName && <p className="text-lg font-semibold">{studentName}</p>}
          {sessionDate && (
            <p className="text-sm text-muted-foreground">
              {new Date(sessionDate).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Accuracy" value={`${stats.accuracy_percentage.toFixed(1)}%`} highlight />
        <StatCard label="WPM" value={String(stats.target_wpm)} />
        <StatCard label="Correct" value={String(stats.correct_words)} />
        <StatCard label="Incorrect" value={String(stats.incorrect_words)} />
        <StatCard label="Points" value={`${stats.points_earned} pts`} highlight={stats.comprehension_bonus} />
      </div>

      {/* Audio player */}
      <div className="bg-muted/40 border rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Headphones className="h-4 w-4 text-primary" />
          Recording
        </p>
        {audioUrl ? (
          <audio controls src={audioUrl} className="w-full h-10" />
        ) : (
          <p className="text-sm text-muted-foreground italic">No recording available for this session.</p>
        )}
      </div>

      {/* Annotated text */}
      {wordResults && wordResults.length > 0 ? (
        <div className="bg-muted/40 border rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold">Word-by-Word Review</p>
          <p
            className="text-sm leading-loose"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            {words.map((word, i) => {
              const status = wordResults[i]?.status ?? 'unread'
              const cls =
                status === 'correct'
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : status === 'incorrect'
                  ? 'text-red-500 dark:text-red-400 font-semibold underline'
                  : 'text-muted-foreground'
              return (
                <span key={i} className={cls} title={
                  status === 'correct' ? 'Correct' :
                  status === 'incorrect' ? 'Mispronounced / incorrect' :
                  'Not reached'
                }>
                  {word}{' '}
                </span>
              )
            })}
          </p>
          {/* Legend */}
          <div className="flex gap-4 text-xs pt-1 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              Correct ({wordResults.filter(r => r.status === 'correct').length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
              Incorrect ({wordResults.filter(r => r.status === 'incorrect').length})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
              Not reached ({wordResults.filter(r => r.status === 'unread').length})
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-muted/40 border rounded-lg p-4 text-sm text-muted-foreground italic">
          Word-level results are not available for this session (manual grading mode or older session).
        </div>
      )}

      {/* Print button */}
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" />
          Print Review
        </Button>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}>
      <p className={`text-xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
