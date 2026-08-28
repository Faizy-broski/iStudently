'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, X, Check, VideoIcon, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  addFaceTag, confirmTagging, getMediaForTagging, removeFaceTag, setNoIdentifiableStudents,
  type CandidateStudent, type FinaFaceTag, type FinaMedia,
} from '@/lib/api/fina-media'
import { GatedMediaImage } from './GatedMediaImage'

/** Shared between admin/fina/media/[id]/tag/page.tsx and
 * teacher/fina/media/[id]/tag/page.tsx — spec §16's manual-tagging equivalent
 * of the observation screen: staff identify who's in the photo (or attest
 * that no one is identifiable) before it can ever be attached to a post. */
export function MediaTaggingScreen({ mediaId, backHref }: { mediaId: string; backHref: string }) {
  const t = useTranslations('fina.media')
  const router = useRouter()

  const [media, setMedia] = useState<FinaMedia | null>(null)
  const [tags, setTags] = useState<FinaFaceTag[]>([])
  const [candidates, setCandidates] = useState<CandidateStudent[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    getMediaForTagging(mediaId).then((res) => {
      if (res.data) {
        setMedia(res.data.media)
        setTags(res.data.tags)
        setCandidates(res.data.candidateStudents)
      }
    })
  }, [mediaId])

  useEffect(() => { load() }, [load])

  const taggedStudentIds = useMemo(() => new Set(tags.map((tag) => tag.student_id).filter(Boolean)), [tags])
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return candidates.filter((c) => {
      if (taggedStudentIds.has(c.id)) return false
      if (!q) return true
      const name = `${c.profile?.first_name ?? ''} ${c.profile?.last_name ?? ''}`.toLowerCase()
      return name.includes(q)
    })
  }, [candidates, search, taggedStudentIds])

  const handleAddTag = async (studentId: string) => {
    setBusy(true)
    try {
      const res = await addFaceTag(mediaId, studentId)
      if (res.error) toast.error(res.error)
      else load()
    } finally {
      setBusy(false)
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    setBusy(true)
    try {
      const res = await removeFaceTag(mediaId, tagId)
      if (res.error) toast.error(res.error)
      else load()
    } finally {
      setBusy(false)
    }
  }

  const handleToggleNoIdentifiable = async () => {
    if (!media) return
    setBusy(true)
    try {
      const res = await setNoIdentifiableStudents(mediaId, !media.no_identifiable_students)
      if (res.error) toast.error(res.error)
      else load()
    } finally {
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    setBusy(true)
    try {
      const res = await confirmTagging(mediaId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t('confirm_success'))
        router.push(backHref)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!media) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-3xl">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  const canConfirm = tags.length > 0 || media.no_identifiable_students

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-5">
      <button onClick={() => router.push(backHref)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" />
        {t('back_to_queue')}
      </button>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{t('tag_screen_title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('tag_screen_subtitle')}</p>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50 max-h-[420px] flex items-center justify-center">
        {media.kind === 'image' ? (
          <GatedMediaImage mediaId={mediaId} raw alt="preview" className="max-h-[420px] w-auto mx-auto" />
        ) : (
          <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
            <VideoIcon className="h-10 w-10" />
            <span className="text-xs">{t('kind_video')}</span>
          </div>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const label = tag.student
              ? [tag.student.profile?.first_name, tag.student.profile?.last_name].filter(Boolean).join(' ')
              : '—'
            return (
              <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 pl-3 pr-1.5 py-1 text-sm text-blue-800">
                {label}
                <button onClick={() => handleRemoveTag(tag.id)} disabled={busy} className="rounded-full hover:bg-blue-100 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <Button
        variant={media.no_identifiable_students ? 'default' : 'outline'}
        onClick={handleToggleNoIdentifiable}
        disabled={busy || tags.length > 0}
        className="gap-2 w-full justify-center"
      >
        {media.no_identifiable_students && <Check className="h-4 w-4" />}
        {media.no_identifiable_students ? t('no_identifiable_active') : t('no_identifiable_button')}
      </Button>

      {!media.no_identifiable_students && (
        <div className="space-y-2">
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('student_search_placeholder')} />
          <Card>
            <CardContent className="p-2 max-h-64 overflow-y-auto divide-y divide-gray-100">
              {filteredCandidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleAddTag(c.id)}
                  disabled={busy}
                  className="w-full text-left px-2 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>{[c.profile?.first_name, c.profile?.last_name].filter(Boolean).join(' ')}</span>
                  {c.section?.name && <span className="text-xs text-gray-400">{c.section.name}</span>}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="pt-2">
        <Button onClick={handleConfirm} disabled={busy || !canConfirm} className="w-full gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t('confirm_button')}
        </Button>
        {!canConfirm && <p className="text-xs text-gray-400 mt-1.5 text-center">{t('confirm_disabled_hint')}</p>}
      </div>
    </div>
  )
}
