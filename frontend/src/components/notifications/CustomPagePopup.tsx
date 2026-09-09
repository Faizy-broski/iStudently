'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getMyPopupPages, dismissPopupPage, type CustomLink } from '@/lib/api/public-pages'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink, FileText, Image as ImageIcon, Code2, Link2 } from 'lucide-react'

function PopupContent({ page }: { page: CustomLink }) {
  if (page.page_type === 'url') {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Link2 className="h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">{page.url}</p>
        <a href={page.url} target="_blank" rel="noopener noreferrer">
          <Button className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Open Link
          </Button>
        </a>
      </div>
    )
  }

  if (page.page_type === 'embed') {
    return (
      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
        <Code2 className="h-4 w-4" />
        <iframe src={page.url} className="w-full rounded-lg border" style={{ height: 420 }} title={page.title} />
      </div>
    )
  }

  if (page.page_type === 'text') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
        </div>
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: page.content ?? '' }} />
      </div>
    )
  }

  if (page.page_type === 'image') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={page.image_url} alt={page.title} className="w-full rounded-lg object-contain max-h-[70vh]" />
      </div>
    )
  }

  return null
}

/**
 * Login popup for pages/posters targeted at the current user's role
 * (Admin Settings → Public Pages → Audience / Portal Visibility). Shown once
 * per profile — closing one permanently dismisses it server-side
 * (custom_page_dismissals), so it never reappears for that user again, even
 * on another device. Multiple active pages are queued one at a time.
 */
export function CustomPagePopup() {
  const { user, profile, loading: authLoading } = useAuth()
  const [queue, setQueue] = useState<CustomLink[]>([])
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    if (authLoading || !user || !profile) return
    let cancelled = false
    getMyPopupPages().then((res) => {
      if (cancelled) return
      if (res.success && res.data) setQueue(res.data)
    })
    return () => { cancelled = true }
  }, [authLoading, user, profile])

  const current = queue[0]

  const handleClose = useCallback(async () => {
    if (!current || dismissing) return
    setDismissing(true)
    try {
      await dismissPopupPage(current.id)
      setQueue((prev) => prev.slice(1))
    } finally {
      setDismissing(false)
    }
  }, [current, dismissing])

  if (!current) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className={current.page_type === 'image' ? 'max-w-2xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
        </DialogHeader>
        <PopupContent page={current} />
      </DialogContent>
    </Dialog>
  )
}
