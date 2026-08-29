'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { listPollsForRoom, submitPollResponse, getPollResults } from '@/lib/api/jitsi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

interface PollResponderProps {
  roomId: string
}

export function PollResponder({ roomId }: PollResponderProps) {
  const t = useTranslations('live_class')
  const [selected, setSelected] = useState<string[]>([])
  const [textAnswer, setTextAnswer] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  // The id of the poll this student last submitted a response to — a boolean
  // "submitted" flag would get wiped the instant the poll closes (openPoll
  // goes from a real id to null, which is itself a dependency change), right
  // when we need to know "yes, I answered *that* poll" to show its results
  // instead of the panel just vanishing.
  const [submittedPollId, setSubmittedPollId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { data: pollsRes, mutate: refetchPolls } = useSWR(
    ['jitsi-polls-responder', roomId],
    () => listPollsForRoom(roomId),
    { revalidateOnFocus: false }
  )

  const polls = pollsRes?.data || []
  const openPoll = polls.find((p) => p.status === 'open') || null
  const submitted = openPoll != null && openPoll.id === submittedPollId

  // The most recently closed poll this student answered — shown briefly so
  // "you answered, here are the results" doesn't just disappear the instant
  // the teacher closes the poll (previously: the whole panel returned null).
  const lastClosedAnsweredPoll = !openPoll
    ? polls.filter((p) => p.status === 'closed' && p.id === submittedPollId)[0] || null
    : null

  const { data: closedResultsRes } = useSWR(
    lastClosedAnsweredPoll ? ['jitsi-poll-results-responder', lastClosedAnsweredPoll.id] : null,
    () => getPollResults(lastClosedAnsweredPoll!.id),
    { revalidateOnFocus: false }
  )

  // Reset local answer state only when a genuinely new poll opens (not on
  // the open -> closed transition of the one we just answered).
  useEffect(() => {
    if (openPoll && openPoll.id !== submittedPollId) {
      setSelected([])
      setTextAnswer('')
      setRating(null)
    }
  }, [openPoll?.id, submittedPollId])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`polls-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jitsi_room_polls', filter: `room_id=eq.${roomId}` },
        () => refetchPolls()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, refetchPolls])

  if (!openPoll) {
    if (!lastClosedAnsweredPoll) return null

    // Poll closed after this student answered it — show the results
    // instead of the panel just disappearing.
    const results = closedResultsRes?.data
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{lastClosedAnsweredPoll.question_text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('poll_closed')}</p>
          <div className="space-y-1">
            {(results?.tally || []).map((row) => (
              <div key={row.option} className="flex justify-between text-sm">
                <span>{row.option}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
            ))}
          </div>
          {results && (
            <p className="text-xs text-muted-foreground">
              {t('responses_count', { count: results.total_responses })}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  const toggleOption = (option: string) => {
    if (openPoll.question_type === 'single_choice') {
      setSelected([option])
      return
    }
    setSelected((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    const res = await submitPollResponse(openPoll.id, {
      selected_options: selected,
      answer_text: textAnswer || undefined,
      rating_value: rating ?? undefined,
    })
    setSubmitting(false)
    if (res.error) { toast.error(res.error); return }
    setSubmittedPollId(openPoll.id)
    toast.success(t('toast_response_submitted'))
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          {t('waiting_for_results')}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{openPoll.question_text}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(openPoll.question_type === 'single_choice' || openPoll.question_type === 'multiple_choice') &&
          (openPoll.options as string[]).map((option) => (
            <Button
              key={option}
              variant={selected.includes(option) ? 'default' : 'outline'}
              className="w-full justify-start"
              onClick={() => toggleOption(option)}
            >
              {option}
            </Button>
          ))}

        {openPoll.question_type === 'rating' && (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} variant={rating === n ? 'default' : 'outline'} size="sm" onClick={() => setRating(n)}>
                {n}
              </Button>
            ))}
          </div>
        )}

        {openPoll.question_type === 'text' && (
          <Input value={textAnswer} onChange={(e) => setTextAnswer(e.target.value)} placeholder={t('answer_placeholder')} />
        )}

        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </CardContent>
    </Card>
  )
}
