'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import type { CreateRoomInput, JitsiRoom } from '@/lib/api/jitsi'

interface RoomFormProps {
  initial?: JitsiRoom
  submitting?: boolean
  onSubmit: (data: CreateRoomInput) => void
  onCancel?: () => void
}

export function RoomForm({ initial, submitting, onSubmit, onCancel }: RoomFormProps) {
  const t = useTranslations('live_class')
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [password, setPassword] = useState(initial?.password || '')
  const [startAudioOnly, setStartAudioOnly] = useState(initial?.start_audio_only ?? false)

  const handleSubmit = () => {
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      password: password.trim() || undefined,
      start_audio_only: startAudioOnly,
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{t('room_title_label')}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('room_title_placeholder')} />
      </div>
      <div className="space-y-1">
        <Label>{t('room_description_label')}</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('room_description_placeholder')} />
      </div>
      <div className="space-y-1">
        <Label>{t('room_password_label')}</Label>
        <Input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('room_password_placeholder')}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="start-audio-only" checked={startAudioOnly} onCheckedChange={(v) => setStartAudioOnly(v === true)} />
        <Label htmlFor="start-audio-only" className="font-normal">{t('start_audio_only_label')}</Label>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit} disabled={submitting || !title.trim()}>
          {submitting ? t('saving') : t('save')}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  )
}
