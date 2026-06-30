'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getAuthToken } from '@/lib/api/schools'
import { getSessionLog, type SessionLog } from '@/lib/api/speed-reading'
import { ReadingReview } from '@/components/admin/speed-reading/ReadingReview'

export default function AdminSessionDetailPage() {
  const { logId } = useParams<{ logId: string }>()
  const router = useRouter()
  const [log, setLog] = useState<SessionLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      const token = await getAuthToken()
      const res = await getSessionLog(logId, token)
      if (res.success && res.data) {
        setLog(res.data)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    }
    load()
  }, [logId])

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (notFound || !log) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        Session not found.
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/speed-reading/sessions')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Sessions
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{log.text_title ?? 'Reading Session'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {log.grading_mode === 'voice' ? 'Voice mode' : 'Manual mode'}
          {log.text_language === 'ar' ? ' · Arabic' : ' · English'}
        </p>
      </div>

      <ReadingReview
        textContent={log.text_content ?? ''}
        textLanguage={log.text_language}
        wordResults={log.word_results}
        audioUrl={log.audio_url}
        studentName={log.student_name}
        sessionDate={log.created_at}
        stats={{
          correct_words: log.correct_words,
          incorrect_words: log.incorrect_words,
          accuracy_percentage: log.accuracy_percentage,
          target_wpm: log.target_wpm,
          points_earned: log.points_earned,
          comprehension_bonus: log.comprehension_bonus,
        }}
      />
    </div>
  )
}
