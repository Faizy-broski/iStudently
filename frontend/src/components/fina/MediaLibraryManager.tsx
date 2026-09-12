'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loader2, Upload, ImageIcon, VideoIcon, CircleDot, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listPendingTagging, listMyReadyMedia, uploadFinaMedia, deleteFinaMedia, type FinaMedia } from '@/lib/api/fina-media'
import { createStory } from '@/lib/api/fina-stories'
import { GatedMediaImage } from './GatedMediaImage'

/**
 * Shared between admin/fina/media/page.tsx and teacher/fina/media/page.tsx —
 * upload, the school's pending-tagging queue, and a "ready to use" section.
 * A confirmed photo leaves "awaiting tagging" immediately but isn't in
 * "ready to use" until the background variant/blur job finishes (usually a
 * few seconds) — auto-refreshing on an interval so that gap doesn't look
 * like the photo vanished.
 */
export function MediaLibraryManager({ basePath }: { basePath: string }) {
  const t = useTranslations('fina.media')
  const [items, setItems] = useState<FinaMedia[] | null>(null)
  const [readyItems, setReadyItems] = useState<FinaMedia[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Two-click delete confirmation: first click arms the button (stores the id),
  // second click within 3 s executes; clicking elsewhere or waiting disarms it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(() => {
    listPendingTagging().then((res) => setItems(res.data ?? []))
    listMyReadyMedia().then((res) => setReadyItems(res.data ?? []))
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 8000)
    return () => clearInterval(interval)
  }, [load])

  // Disarm confirm on any outside click
  useEffect(() => {
    if (!confirmDeleteId) return
    const handler = () => {
      setConfirmDeleteId(null)
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [confirmDeleteId])

  const handlePostAsStory = async (mediaId: string) => {
    const res = await createStory(mediaId)
    if (res.error) toast.error(res.error)
    else toast.success(t('story_posted'))
  }

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const res = await uploadFinaMedia(file)
        if (res.error) toast.error(`${file.name}: ${res.error}`)
      }
      load()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  /**
   * First click: arm confirmation (button turns red, auto-disarms after 3 s).
   * Second click: execute delete and optimistically remove from local state.
   */
  const handleDeleteClick = async (e: React.MouseEvent, mediaId: string) => {
    e.preventDefault()   // prevent Link navigation on pending-queue items
    e.stopPropagation()

    if (confirmDeleteId !== mediaId) {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
      setConfirmDeleteId(mediaId)
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000)
      return
    }

    // Confirmed — execute
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current)
    setConfirmDeleteId(null)
    setDeleting(mediaId)
    try {
      const res = await deleteFinaMedia(mediaId)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(t('delete_success'))
        // Optimistically remove from both lists so the grid updates immediately.
        setItems((prev) => prev?.filter((m) => m.id !== mediaId) ?? prev)
        setReadyItems((prev) => prev?.filter((m) => m.id !== mediaId) ?? prev)
      }
    } finally {
      setDeleting(null)
    }
  }

  /** Trash button with two-step confirmation, shared by both grids. */
  const DeleteButton = ({ mediaId }: { mediaId: string }) => {
    const armed = confirmDeleteId === mediaId
    const busy = deleting === mediaId
    return (
      <button
        onClick={(e) => handleDeleteClick(e, mediaId)}
        disabled={busy}
        className={[
          'absolute top-1 right-1 rounded-full p-1.5 transition-all',
          'opacity-0 group-hover:opacity-100',
          armed ? 'bg-red-600 hover:bg-red-700 !opacity-100' : 'bg-black/60 hover:bg-black/80',
          busy ? 'cursor-wait' : '',
        ].join(' ')}
        title={armed ? t('delete_confirm') : t('delete_button')}
      >
        {busy
          ? <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
          : <Trash2 className="h-3.5 w-3.5 text-white" />}
      </button>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('page_title')}</h1>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            data-no-unsaved-warning
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? t('uploading') : t('upload_button')}
          </Button>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('pending_queue_title')}</h2>
        {items === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('pending_queue_empty')}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item) => (
              <div key={item.id} className="relative group">
                <Link href={`${basePath}/${item.id}/tag`} className="block">
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    {item.kind === 'image' ? (
                      <GatedMediaImage mediaId={item.id} raw thumb alt={item.id} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <VideoIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-full p-1">
                      {item.kind === 'image' ? <ImageIcon className="h-3 w-3 text-white" /> : <VideoIcon className="h-3 w-3 text-white" />}
                    </div>
                  </div>
                </Link>
                <DeleteButton mediaId={item.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">{t('ready_section_title')}</h2>
        {readyItems === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
        ) : readyItems.length === 0 ? (
          <p className="text-sm text-gray-400">{t('ready_section_empty')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {readyItems.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                {item.kind === 'image' ? (
                  <GatedMediaImage mediaId={item.id} variant="thumb" alt={item.id} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <VideoIcon className="h-8 w-8" />
                  </div>
                )}
                {item.kind === 'image' && (
                  <button
                    onClick={() => handlePostAsStory(item.id)}
                    className="absolute bottom-1 left-1 bg-black/60 hover:bg-black/80 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={t('post_as_story')}
                  >
                    <CircleDot className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
                <DeleteButton mediaId={item.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
