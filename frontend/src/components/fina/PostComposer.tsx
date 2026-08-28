'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Check, X, ImagePlus, ArrowLeft, Upload, RefreshCw, UserRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { createPost, submitPost, getComposerOptions, type PostType, type CreatePostInput } from '@/lib/api/fina-posts'
import {
  listMyReadyMedia, listPendingTagging, uploadFinaMedia,
  getMediaForTagging, addFaceTag, removeFaceTag, setNoIdentifiableStudents, confirmTagging,
  type FinaMedia, type FinaFaceTag,
} from '@/lib/api/fina-media'
import { POST_TYPE_META, POST_TYPES } from './postTypeMeta'
import { GatedMediaImage } from './GatedMediaImage'

/**
 * Type-first composer (spec §16.4): type is chosen FIRST, then only that
 * type's own fields are shown — never a generic form asking the type
 * afterward. Audience defaults to the narrowest (the composer's own
 * classes/students), matching "widening requires a deliberate act".
 *
 * A freshly-uploaded photo still needs tagging before it can be attached —
 * that step happens inline, right inside the "add photos" dialog below
 * (see the taggingMediaId state), never a separate page navigation. Losing
 * an in-progress draft (title/body already typed) just because a photo
 * needed tagging would be exactly the kind of friction the spec's own
 * "under 2 minutes, done" persona goal explicitly warns against.
 */
export function PostComposer({ wallHref }: { wallHref: string }) {
  const t = useTranslations('fina.composer')
  const tp = useTranslations('fina.posts')
  const router = useRouter()

  const [type, setType] = useState<PostType | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [readyMedia, setReadyMedia] = useState<FinaMedia[]>([])
  const [audienceType, setAudienceType] = useState<'school' | 'classes' | 'students'>('classes')
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([])
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [composerOptions, setComposerOptions] = useState<{ sections: { id: string; name: string }[]; students: { id: string; sectionId: string | null; name: string }[] }>({ sections: [], students: [] })
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollClosesAt, setPollClosesAt] = useState('')
  const [reminderDatetime, setReminderDatetime] = useState('')
  const [resourceUrl, setResourceUrl] = useState('')
  const [isEmergency, setIsEmergency] = useState(false)
  const [commentsEnabled, setCommentsEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [pendingMedia, setPendingMedia] = useState<FinaMedia[]>([])
  const [uploadingInDialog, setUploadingInDialog] = useState(false)
  const dialogFileInputRef = useRef<HTMLInputElement>(null)

  // Inline tagging (no separate page/new tab — see the component doc comment).
  const [taggingMediaId, setTaggingMediaId] = useState<string | null>(null)
  const [taggingTags, setTaggingTags] = useState<FinaFaceTag[]>([])
  const [taggingNoIdentifiable, setTaggingNoIdentifiable] = useState(false)
  const [taggingBusy, setTaggingBusy] = useState(false)

  const loadMedia = () => {
    listMyReadyMedia().then((res) => setReadyMedia(res.data ?? []))
    listPendingTagging().then((res) => setPendingMedia(res.data ?? []))
  }

  const openInlineTagging = async (mediaId: string) => {
    setTaggingMediaId(mediaId)
    const res = await getMediaForTagging(mediaId)
    if (res.data) {
      setTaggingTags(res.data.tags)
      setTaggingNoIdentifiable(res.data.media.no_identifiable_students)
    }
  }

  const closeInlineTagging = () => setTaggingMediaId(null)

  const refreshInlineTagging = async () => {
    if (!taggingMediaId) return
    const res = await getMediaForTagging(taggingMediaId)
    if (res.data) {
      setTaggingTags(res.data.tags)
      setTaggingNoIdentifiable(res.data.media.no_identifiable_students)
    }
  }

  const handleInlineAddTag = async (studentId: string) => {
    if (!taggingMediaId) return
    setTaggingBusy(true)
    try {
      const res = await addFaceTag(taggingMediaId, studentId)
      if (res.error) toast.error(res.error)
      else await refreshInlineTagging()
    } finally {
      setTaggingBusy(false)
    }
  }

  const handleInlineRemoveTag = async (tagId: string) => {
    if (!taggingMediaId) return
    setTaggingBusy(true)
    try {
      const res = await removeFaceTag(taggingMediaId, tagId)
      if (res.error) toast.error(res.error)
      else await refreshInlineTagging()
    } finally {
      setTaggingBusy(false)
    }
  }

  const handleInlineToggleNoIdentifiable = async () => {
    if (!taggingMediaId) return
    setTaggingBusy(true)
    try {
      const res = await setNoIdentifiableStudents(taggingMediaId, !taggingNoIdentifiable)
      if (res.error) toast.error(res.error)
      else await refreshInlineTagging()
    } finally {
      setTaggingBusy(false)
    }
  }

  const handleInlineConfirmTagging = async () => {
    if (!taggingMediaId) return
    setTaggingBusy(true)
    try {
      const res = await confirmTagging(taggingMediaId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t('inline_tagging_confirmed'))
        closeInlineTagging()
        loadMedia()
      }
    } finally {
      setTaggingBusy(false)
    }
  }

  useEffect(() => {
    loadMedia()
    getComposerOptions().then((res) => { if (res.data) setComposerOptions(res.data) })
  }, [])

  const handleDialogUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingInDialog(true)
    try {
      for (const file of Array.from(files)) {
        const res = await uploadFinaMedia(file)
        if (res.error) toast.error(`${file.name}: ${res.error}`)
      }
      loadMedia()
    } finally {
      setUploadingInDialog(false)
      if (dialogFileInputRef.current) dialogFileInputRef.current.value = ''
    }
  }

  const reset = () => {
    setType(null); setTitle(''); setBody(''); setSelectedMediaIds([])
    setSelectedSectionIds([]); setSelectedStudentIds([]); setPollQuestion('')
    setPollOptions(['', '']); setPollClosesAt(''); setReminderDatetime(''); setResourceUrl('')
    setIsEmergency(false); setCommentsEnabled(true)
  }

  const toggleMedia = (id: string) => {
    setSelectedMediaIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]))
  }

  const canSubmit = useMemo(() => {
    if (!type) return false
    if (type === 'poll') return !!pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2
    if (type === 'achievement') return selectedStudentIds.length === 1 && !!title.trim()
    if (type === 'reminder') return !!title.trim() && !!reminderDatetime
    if (type === 'resource') return !!title.trim() && !!resourceUrl.trim()
    return !!body.trim() || !!title.trim()
  }, [type, pollQuestion, pollOptions, selectedStudentIds, title, reminderDatetime, resourceUrl, body])

  const handleSubmit = async () => {
    if (!type) return
    setSubmitting(true)
    try {
      const input: CreatePostInput = {
        type,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        media_ids: selectedMediaIds.length ? selectedMediaIds : undefined,
        comments_enabled: commentsEnabled,
      }

      if (type === 'achievement') {
        input.audience_type = 'students'
        input.audience_ref = { student_ids: selectedStudentIds }
        input.type_data = { student_id: selectedStudentIds[0] }
      } else if (type === 'urgent') {
        input.audience_type = 'school'
        input.is_emergency = isEmergency
      } else if (type === 'poll') {
        input.audience_type = audienceType
        input.audience_ref = audienceType === 'classes' ? { section_ids: selectedSectionIds } : audienceType === 'students' ? { student_ids: selectedStudentIds } : {}
        input.type_data = { question: pollQuestion.trim(), options: pollOptions.filter((o) => o.trim()), closes_at: pollClosesAt || null }
      } else if (type === 'reminder') {
        input.audience_type = audienceType
        input.audience_ref = audienceType === 'classes' ? { section_ids: selectedSectionIds } : audienceType === 'students' ? { student_ids: selectedStudentIds } : {}
        input.type_data = { datetime: reminderDatetime }
      } else if (type === 'resource') {
        input.audience_type = audienceType
        input.audience_ref = audienceType === 'classes' ? { section_ids: selectedSectionIds } : audienceType === 'students' ? { student_ids: selectedStudentIds } : {}
        input.type_data = { url: resourceUrl.trim() }
      } else {
        input.audience_type = audienceType
        input.audience_ref = audienceType === 'classes' ? { section_ids: selectedSectionIds } : audienceType === 'students' ? { student_ids: selectedStudentIds } : {}
      }

      const created = await createPost(input)
      if (created.error || !created.data) {
        toast.error(created.error || t('error_generic'))
        return
      }

      const submitted = await submitPost(created.data.id)
      if (submitted.error) {
        toast.error(submitted.error)
        return
      }

      toast.success(t('submit_success'))
      reset()
      router.push(wallHref)
    } finally {
      setSubmitting(false)
    }
  }

  const AudiencePicker = () => (
    <div className="space-y-2">
      <Label>{t('field_audience')}</Label>
      <RadioGroup value={audienceType} onValueChange={(v) => setAudienceType(v as any)} className="flex gap-4">
        <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="classes" />{t('audience_classes')}</label>
        <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="students" />{t('audience_students')}</label>
        <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="school" />{t('audience_school')}</label>
      </RadioGroup>
      {audienceType === 'classes' && (
        <div className="flex flex-wrap gap-1.5">
          {composerOptions.sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSectionIds((prev) => prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id])}
              className={`text-xs px-2.5 py-1 rounded-full border ${selectedSectionIds.includes(s.id) ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-200 text-gray-600'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {audienceType === 'students' && (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {composerOptions.students.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStudentIds((prev) => prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id])}
              className={`text-xs px-2.5 py-1 rounded-full border ${selectedStudentIds.includes(s.id) ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-200 text-gray-600'}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Nothing appears here unless the composer author deliberately attached
  // it — a persistent "here's every ready photo you own" grid looked like
  // those photos were already part of the post, which is exactly the
  // ambiguity this module can least afford. Attaching is now a distinct
  // step behind an explicit button + dialog; only SELECTED photos ever show
  // in the composer body itself, each individually removable.
  const MediaPicker = () => {
    const selectedMedia = readyMedia.filter((m) => selectedMediaIds.includes(m.id))
    return (
      <div className="space-y-1.5">
        <Label className="block">{t('field_photos')}</Label>

        {selectedMedia.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5">
            {selectedMedia.map((m) => (
              <div key={m.id} className="relative aspect-square rounded-md overflow-hidden border border-gray-200">
                <GatedMediaImage mediaId={m.id} variant="thumb" alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => toggleMedia(m.id)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1 hover:bg-black/80"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => setMediaPickerOpen(true)} className="gap-1.5">
          <ImagePlus className="h-3.5 w-3.5" />
          {t('add_photos')}
        </Button>

        <Dialog open={mediaPickerOpen} onOpenChange={(open) => { setMediaPickerOpen(open); if (!open) closeInlineTagging() }}>
          <DialogContent className="max-w-lg">
            {taggingMediaId ? (
              <>
                <DialogHeader><DialogTitle>{t('inline_tagging_title')}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="rounded-md overflow-hidden bg-gray-50 max-h-64 flex items-center justify-center">
                    <GatedMediaImage mediaId={taggingMediaId} raw alt="" className="max-h-64 w-auto mx-auto" />
                  </div>

                  {taggingTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {taggingTags.map((tag) => (
                        <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 pl-3 pr-1.5 py-1 text-sm text-blue-800">
                          {[tag.student?.profile?.first_name, tag.student?.profile?.last_name].filter(Boolean).join(' ') || '—'}
                          <button onClick={() => handleInlineRemoveTag(tag.id)} disabled={taggingBusy} className="rounded-full hover:bg-blue-100 p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant={taggingNoIdentifiable ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleInlineToggleNoIdentifiable}
                    disabled={taggingBusy || taggingTags.length > 0}
                    className="w-full justify-center gap-1.5"
                  >
                    {taggingNoIdentifiable && <Check className="h-3.5 w-3.5" />}
                    {taggingNoIdentifiable ? t('no_identifiable_active') : t('no_identifiable_button')}
                  </Button>

                  {!taggingNoIdentifiable && (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {composerOptions.students
                        .filter((s) => !taggingTags.some((tag) => tag.student_id === s.id))
                        .map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleInlineAddTag(s.id)}
                            disabled={taggingBusy}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                          >
                            <UserRound className="h-3 w-3" />
                            {s.name}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={closeInlineTagging} disabled={taggingBusy}>{t('back_button')}</Button>
                  <Button
                    onClick={handleInlineConfirmTagging}
                    disabled={taggingBusy || (taggingTags.length === 0 && !taggingNoIdentifiable)}
                    className="gap-2"
                  >
                    {taggingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {t('confirm_button')}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader><DialogTitle>{t('add_photos')}</DialogTitle></DialogHeader>

                <div className="flex items-center gap-2">
                  <input
                    ref={dialogFileInputRef}
                    type="file"
                    data-no-unsaved-warning
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                    multiple
                    className="hidden"
                    onChange={(e) => handleDialogUpload(e.target.files)}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => dialogFileInputRef.current?.click()} disabled={uploadingInDialog} className="gap-1.5">
                    {uploadingInDialog ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingInDialog ? t('uploading') : t('upload_from_device')}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={loadMedia} title={t('refresh_button')}>
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {readyMedia.length === 0 && pendingMedia.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">{t('ready_section_empty_composer')}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 max-h-80 overflow-y-auto">
                    {readyMedia.map((m) => {
                      const selected = selectedMediaIds.includes(m.id)
                      return (
                        <button key={m.id} onClick={() => toggleMedia(m.id)} className="relative aspect-square rounded-md overflow-hidden border-2" style={{ borderColor: selected ? '#022172' : 'transparent' }}>
                          <GatedMediaImage mediaId={m.id} variant="thumb" alt="" className="w-full h-full object-cover" />
                          {selected && <div className="absolute top-1 right-1 bg-[#022172] rounded-full p-0.5"><Check className="h-3 w-3 text-white" /></div>}
                        </button>
                      )
                    })}
                  </div>
                )}

                {pendingMedia.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">{t('needs_tagging_notice')}</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {pendingMedia.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => openInlineTagging(m.id)}
                          className="relative aspect-square rounded-md overflow-hidden border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100"
                        >
                          <GatedMediaImage mediaId={m.id} raw alt="" className="w-full h-full object-cover opacity-60" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white text-[10px] font-medium px-1 text-center">
                            {t('tap_to_tag')}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={() => setMediaPickerOpen(false)}>{t('done_button')}</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (!type) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl space-y-4">
        <button onClick={() => router.push(wallHref)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          {t('back_button')}
        </button>
        <h1 className="text-xl font-bold text-gray-900">{t('step_choose_type')}</h1>
        <div className="grid grid-cols-2 gap-3">
          {POST_TYPES.map((pt) => {
            const meta = POST_TYPE_META[pt]
            const Icon = meta.icon
            return (
              <button key={pt} onClick={() => setType(pt)} className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
                <span className="flex items-center justify-center h-10 w-10 rounded-full" style={{ backgroundColor: meta.bg }}>
                  <Icon className="h-5 w-5" style={{ color: meta.color }} />
                </span>
                <span className="text-sm font-medium text-gray-800">{tp(`type_${pt}`)}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const meta = POST_TYPE_META[type]
  const Icon = meta.icon

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <button onClick={() => setType(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        {t('back_button')}
      </button>

      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center h-8 w-8 rounded-full" style={{ backgroundColor: meta.bg }}>
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
        </span>
        <h1 className="text-lg font-bold text-gray-900">{tp(`type_${type}`)}</h1>
        <button onClick={() => router.push(wallHref)} className="ms-auto text-gray-400 hover:text-gray-600" title={t('cancel_button')}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <Card>
        <CardContent className="py-4 space-y-4">
          {type === 'achievement' ? (
            <div className="space-y-1.5">
              <Label>{t('field_achievement_student')}</Label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {composerOptions.students.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudentIds([s.id])}
                    className={`text-xs px-2.5 py-1 rounded-full border ${selectedStudentIds[0] === s.id ? 'bg-[#022172] text-white border-[#022172]' : 'border-gray-200 text-gray-600'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {(type === 'activity' || type === 'announcement' || type === 'achievement' || type === 'congratulation' || type === 'resource' || type === 'reminder') && (
            <div className="space-y-1.5">
              <Label>{t('field_title')}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          )}

          {(type === 'activity' || type === 'announcement' || type === 'achievement' || type === 'congratulation' || type === 'resource' || type === 'urgent') && (
            <div className="space-y-1.5">
              <Label>{t('field_body')}</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </div>
          )}

          {type === 'resource' && (
            <div className="space-y-1.5">
              <Label>{t('field_resource_url')}</Label>
              <Input value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="https://" />
            </div>
          )}

          {type === 'reminder' && (
            <div className="space-y-1.5">
              <Label>{t('field_reminder_datetime')}</Label>
              <Input type="datetime-local" value={reminderDatetime} onChange={(e) => setReminderDatetime(e.target.value)} />
            </div>
          )}

          {type === 'poll' && (
            <>
              <div className="space-y-1.5">
                <Label>{t('field_poll_question')}</Label>
                <Input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('field_poll_options')}</Label>
                {pollOptions.map((opt, i) => (
                  <Input key={i} value={opt} onChange={(e) => setPollOptions((prev) => prev.map((o, idx) => idx === i ? e.target.value : o))} className="mb-1.5" />
                ))}
                <Button variant="outline" size="sm" onClick={() => setPollOptions((prev) => [...prev, ''])}>{t('add_option')}</Button>
              </div>
              <div className="space-y-1.5">
                <Label>{t('field_poll_closes_at')}</Label>
                <Input type="datetime-local" value={pollClosesAt} onChange={(e) => setPollClosesAt(e.target.value)} />
              </div>
            </>
          )}

          {(type === 'activity' || type === 'announcement' || type === 'achievement' || type === 'congratulation') && <MediaPicker />}

          {type === 'urgent' ? (
            <div className="flex items-center justify-between rounded-md bg-red-50 p-3">
              <div>
                <Label>{t('emergency_toggle')}</Label>
                <p className="text-xs text-gray-500 mt-0.5">{t('emergency_notice')}</p>
              </div>
              <Switch checked={isEmergency} onCheckedChange={setIsEmergency} />
            </div>
          ) : (
            type !== 'achievement' && <AudiencePicker />
          )}

          {type !== 'achievement' && (
            <div className="flex items-center justify-between">
              <Label>{t('comments_enabled_label')}</Label>
              <Switch checked={commentsEnabled} onCheckedChange={setCommentsEnabled} />
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="w-full gap-2">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? t('submitting') : t('submit_button')}
      </Button>
    </div>
  )
}
