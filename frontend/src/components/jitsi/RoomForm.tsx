'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCampus } from '@/context/CampusContext'
import { getGradeLevels, getSections, type GradeLevel, type Section } from '@/lib/api/academics'
import type { CreateRoomInput, JitsiRoom } from '@/lib/api/jitsi'

interface RoomFormProps {
  initial?: JitsiRoom
  submitting?: boolean
  onSubmit: (data: CreateRoomInput) => void
  onCancel?: () => void
}

/** Sentinel for "no restriction at this level" in the Select components (which can't use an empty string value). */
const ANY = '__any__'

export function RoomForm({ initial, submitting, onSubmit, onCancel }: RoomFormProps) {
  const t = useTranslations('live_class')
  const campusContext = useCampus()
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [password, setPassword] = useState(initial?.password || '')
  const [startAudioOnly, setStartAudioOnly] = useState(initial?.start_audio_only ?? false)

  // Audience targeting — all blank (ANY) means whole school, matching
  // today's behavior exactly. Defaults to the currently selected campus,
  // but can be changed (e.g. an admin targeting a different campus).
  const [targetCampusId, setTargetCampusId] = useState(
    initial?.target_campus_id || campusContext?.selectedCampus?.id || ANY
  )
  const [targetGradeId, setTargetGradeId] = useState(initial?.target_grade_level_id || ANY)
  const [targetSectionId, setTargetSectionId] = useState(initial?.target_section_id || ANY)

  const [grades, setGrades] = useState<GradeLevel[]>([])
  const [sections, setSections] = useState<Section[]>([])

  useEffect(() => {
    if (targetCampusId === ANY) { setGrades([]); return }
    getGradeLevels(targetCampusId).then((res) => setGrades(res.data || []))
  }, [targetCampusId])

  useEffect(() => {
    if (targetCampusId === ANY || targetGradeId === ANY) { setSections([]); return }
    getSections(targetGradeId, targetCampusId).then((res) => setSections(res.data || []))
  }, [targetCampusId, targetGradeId])

  const handleCampusChange = (v: string) => {
    setTargetCampusId(v)
    setTargetGradeId(ANY)
    setTargetSectionId(ANY)
  }

  const handleGradeChange = (v: string) => {
    setTargetGradeId(v)
    setTargetSectionId(ANY)
  }

  const handleSubmit = () => {
    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      password: password.trim() || undefined,
      start_audio_only: startAudioOnly,
      target_campus_id: targetCampusId === ANY ? null : targetCampusId,
      target_grade_level_id: targetGradeId === ANY ? null : targetGradeId,
      target_section_id: targetSectionId === ANY ? null : targetSectionId,
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

      <div className="space-y-2 rounded-md border p-3">
        <Label className="text-sm font-medium">{t('audience_label')}</Label>
        <p className="text-xs text-muted-foreground">{t('audience_help')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={targetCampusId} onValueChange={handleCampusChange}>
            <SelectTrigger><SelectValue placeholder={t('audience_campus_placeholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('audience_whole_school')}</SelectItem>
              {(campusContext?.campuses || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetGradeId} onValueChange={handleGradeChange} disabled={targetCampusId === ANY}>
            <SelectTrigger><SelectValue placeholder={t('audience_grade_placeholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('audience_all_grades')}</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={targetSectionId} onValueChange={setTargetSectionId} disabled={targetGradeId === ANY}>
            <SelectTrigger><SelectValue placeholder={t('audience_section_placeholder')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('audience_all_sections')}</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
