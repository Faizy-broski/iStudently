'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import {
  listPollsForRoom, launchPoll, closePoll, getPollResults,
  type PollQuestionType,
} from '@/lib/api/jitsi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface PollLauncherProps {
  roomId: string
}

/**
 * Owner-side poll control. Subscribes to postgres_changes purely as a
 * "something changed, refetch" signal (same pattern as NotificationBell.tsx)
 * — the realtime payload itself is never trusted for response data.
 */
export function PollLauncher({ roomId }: PollLauncherProps) {
  const t = useTranslations('live_class')
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<PollQuestionType>('single_choice')
  const [optionsText, setOptionsText] = useState('')
  const [launching, setLaunching] = useState(false)
  const [closing, setClosing] = useState(false)

  const { data: pollsRes, mutate: refetchPolls } = useSWR(
    ['jitsi-polls', roomId],
    () => listPollsForRoom(roomId),
    { revalidateOnFocus: false }
  )

  const polls = pollsRes?.data || []
  const openPoll = polls.find((p) => p.status === 'open') || null

  const { data: resultsRes, mutate: refetchResults } = useSWR(
    openPoll ? ['jitsi-poll-results', openPoll.id] : null,
    () => getPollResults(openPoll!.id),
    { revalidateOnFocus: false, refreshInterval: 4000 }
  )

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`polls-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jitsi_room_polls', filter: `room_id=eq.${roomId}` },
        () => refetchPolls()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jitsi_room_poll_responses', filter: `room_id=eq.${roomId}` },
        () => refetchResults()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, refetchPolls, refetchResults])

  const handleLaunch = async () => {
    if (!questionText.trim()) { toast.warning(t('toast_enter_question')); return }
    const options = optionsText.split('\n').map((o) => o.trim()).filter(Boolean)
    if ((questionType === 'single_choice' || questionType === 'multiple_choice') && options.length < 2) {
      toast.warning(t('toast_add_options'))
      return
    }
    setLaunching(true)
    const res = await launchPoll(roomId, { question_text: questionText.trim(), question_type: questionType, options })
    setLaunching(false)
    if (res.error) { toast.error(res.error); return }
    setQuestionText('')
    setOptionsText('')
    refetchPolls()
  }

  const handleClose = async () => {
    if (!openPoll) return
    setClosing(true)
    const res = await closePoll(openPoll.id)
    setClosing(false)
    if (res.error) { toast.error(res.error); return }
    refetchPolls()
  }

  if (openPoll) {
    const results = resultsRes?.data
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{openPoll.question_text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            {(results?.tally || []).map((row) => (
              <div key={row.option} className="flex justify-between text-sm">
                <span>{row.option}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('responses_count', { count: results?.total_responses ?? 0 })}
          </p>
          <Button size="sm" variant="destructive" onClick={handleClose} disabled={closing}>
            {closing ? t('closing') : t('close_poll')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('launch_a_poll')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>{t('question_label')}</Label>
          <Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder={t('question_placeholder')} />
        </div>
        <div className="space-y-1">
          <Label>{t('type_label')}</Label>
          <Select value={questionType} onValueChange={(v) => setQuestionType(v as PollQuestionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single_choice">{t('type_single_choice')}</SelectItem>
              <SelectItem value="multiple_choice">{t('type_multiple_choice')}</SelectItem>
              <SelectItem value="rating">{t('type_rating')}</SelectItem>
              <SelectItem value="text">{t('type_text')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(questionType === 'single_choice' || questionType === 'multiple_choice') && (
          <div className="space-y-1">
            <Label>{t('options_label')}</Label>
            <textarea
              className="w-full rounded-md border p-2 text-sm"
              rows={4}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder={'3\n4\n5'}
            />
          </div>
        )}
        <Button onClick={handleLaunch} disabled={launching}>
          {launching ? t('launching') : t('launch_poll')}
        </Button>
      </CardContent>
    </Card>
  )
}
