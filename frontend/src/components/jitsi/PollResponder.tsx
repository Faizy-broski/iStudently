'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { listPollsForRoom, submitPollResponse } from '@/lib/api/jitsi'
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
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const { data: pollsRes, mutate: refetchPolls } = useSWR(
    ['jitsi-polls-responder', roomId],
    () => listPollsForRoom(roomId),
    { revalidateOnFocus: false }
  )

  const polls = pollsRes?.data || []
  const openPoll = polls.find((p) => p.status === 'open') || null

  // Reset local answer state whenever a new poll opens.
  useEffect(() => {
    setSelected([])
    setTextAnswer('')
    setRating(null)
    setSubmitted(false)
  }, [openPoll?.id])

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

  if (!openPoll) return null

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
    setSubmitted(true)
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
