'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ShieldCheck, Loader2, Check, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  listReviewQueue, listApprovalQueue,
  reviewPost, approvePost, rejectApproval,
} from '@/lib/api/fina-posts'
// NOTE: the emergency post-hoc review queue (backend:
// moderation.service.ts::listPostHocReviewQueue /
// POST /fina/posts/:id/post-hoc-review) has no dedicated UI yet — a
// disclosed Phase 2 scope gap, not a silent one. Add a `mode: 'post_hoc'`
// branch here (or a small dedicated page) when that's needed.
import type { FinaPost } from '@/lib/api/fina-posts'
import { POST_TYPE_META } from './postTypeMeta'
import { GatedMediaImage } from './GatedMediaImage'
import { NotificationBell } from './NotificationBell'

type Mode = 'review' | 'approval'

const REJECT_PRESET_KEYS = ['reject_reason_preset_1', 'reject_reason_preset_2', 'reject_reason_preset_3', 'reject_reason_preset_4']

export function ModerationQueueList({ mode }: { mode: Mode }) {
  const t = useTranslations('fina.moderation')
  const tp = useTranslations('fina.posts')
  const [posts, setPosts] = useState<FinaPost[] | null>(null)
  const [rejectTarget, setRejectTarget] = useState<FinaPost | null>(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    const fetcher = mode === 'review' ? listReviewQueue : listApprovalQueue
    fetcher().then((res) => setPosts((res.data as FinaPost[]) ?? []))
  }, [mode])

  useEffect(() => { load() }, [load])

  const handleApprove = async (post: FinaPost) => {
    setBusyId(post.id)
    try {
      const res = mode === 'review' ? await reviewPost(post.id, 'approve') : await approvePost(post.id)
      if (res.error) toast.error(res.error)
      else { toast.success(t('action_success')); load() }
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (post: FinaPost) => { setRejectTarget(post); setReason('') }

  const confirmReject = async () => {
    if (!rejectTarget || !reason.trim()) return
    setBusyId(rejectTarget.id)
    try {
      const res = mode === 'review' ? await reviewPost(rejectTarget.id, 'reject', reason.trim()) : await rejectApproval(rejectTarget.id, reason.trim())
      if (res.error) toast.error(res.error)
      else { toast.success(t('action_success')); setRejectTarget(null); load() }
    } finally {
      setBusyId(null)
    }
  }

  const title = mode === 'review' ? t('review_queue_title') : t('approval_queue_title')
  const emptyText = mode === 'review' ? t('review_queue_empty') : t('approval_queue_empty')

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <NotificationBell />
      </div>

      {posts === null ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{emptyText}</CardContent></Card>
      ) : (
        posts.map((post) => {
          const meta = POST_TYPE_META[post.type]
          const Icon = meta.icon
          return (
            <Card key={post.id}>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center h-7 w-7 rounded-full" style={{ backgroundColor: meta.bg }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  </span>
                  <span className="text-xs font-medium" style={{ color: meta.color }}>{tp(`type_${post.type}`)}</span>
                  <span className="ms-auto text-xs text-gray-400">
                    {[post.author?.first_name, post.author?.last_name].filter(Boolean).join(' ')}
                  </span>
                </div>

                {post.title && <h3 className="font-semibold text-gray-900">{post.title}</h3>}
                {post.body && <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.body}</p>}

                {post.media.length > 0 && (
                  <div className="flex gap-1.5">
                    {post.media.slice(0, 4).map((m) => (
                      <div key={m.id} className="h-16 w-16 rounded-md overflow-hidden bg-gray-50">
                        <GatedMediaImage mediaId={m.id} raw alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                {mode === 'approval' && (
                  <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t('approval_badge')}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => handleApprove(post)} disabled={busyId === post.id} className="gap-1.5 flex-1">
                    {busyId === post.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {t('approve_button')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReject(post)} disabled={busyId === post.id} className="gap-1.5 flex-1">
                    <X className="h-3.5 w-3.5" />
                    {t('reject_button')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('reject_dialog_title')}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {REJECT_PRESET_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setReason(t(key))}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  {t(key)}
                </button>
              ))}
            </div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reject_reason_placeholder')} rows={3} />
          </div>
          <DialogFooter>
            <Button onClick={confirmReject} disabled={!reason.trim() || busyId === rejectTarget?.id} className="gap-2">
              {busyId === rejectTarget?.id && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('reject_confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
