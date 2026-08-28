'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Send, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { addComment, listComments, moderateComment, type FinaComment } from '@/lib/api/fina-posts'

// super_admin excluded — spec §12: SYSADMIN has zero content access,
// including comment moderation. This is a UI-only mirror of the backend
// gate (post-social.service.ts's MODERATOR_ROLES) which already rejects it.
const MODERATOR_ROLES = ['admin', 'media_officer']

export function CommentsSection({ postId, postAuthorId, commentsEnabled }: { postId: string; postAuthorId: string; commentsEnabled: boolean }) {
  const t = useTranslations('fina.wall')
  const { profile } = useAuth()
  const [comments, setComments] = useState<FinaComment[] | null>(null)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [moderatingId, setModeratingId] = useState<string | null>(null)

  const canModerate = !!profile && (MODERATOR_ROLES.includes(profile.role) || profile.id === postAuthorId)

  const load = () => listComments(postId).then((res) => setComments(res.data ?? []))

  useEffect(() => { load() }, [postId])

  const handleSend = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      const res = await addComment(postId, body.trim())
      if (res.error) {
        toast.error(res.error)
      } else {
        setBody('')
        // Only the roles NOT auto-approved (spec §12: guardian/student) ever
        // actually land in 'pending' — showing this toast unconditionally,
        // regardless of the comment's real returned state, was itself a bug
        // (an admin/teacher's own comment is approved immediately).
        if (res.data?.state === 'pending') toast.success(t('comment_pending_notice'))
        load()
      }
    } finally {
      setSending(false)
    }
  }

  const handleModerate = async (commentId: string, decision: 'approve' | 'reject') => {
    setModeratingId(commentId)
    try {
      const res = await moderateComment(commentId, decision)
      if (res.error) toast.error(res.error)
      else load()
    } finally {
      setModeratingId(null)
    }
  }

  return (
    <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
      {comments === null ? (
        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-gray-400">{t('no_comments_yet')}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div key={c.id} className="text-sm flex items-start justify-between gap-2">
              <div>
                <span className="font-medium text-gray-800">
                  {[c.author?.first_name, c.author?.last_name].filter(Boolean).join(' ') || '—'}
                </span>{' '}
                <span className="text-gray-600">{c.body}</span>
                {c.state === 'pending' && (
                  <span className="ms-2 text-xs text-amber-600">{t('comment_pending_badge')}</span>
                )}
              </div>
              {c.state === 'pending' && canModerate && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleModerate(c.id, 'approve')}
                    disabled={moderatingId === c.id}
                    className="rounded-full p-1 text-emerald-600 hover:bg-emerald-50"
                    title={t('moderate_approve')}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleModerate(c.id, 'reject')}
                    disabled={moderatingId === c.id}
                    className="rounded-full p-1 text-red-600 hover:bg-red-50"
                    title={t('moderate_reject')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {commentsEnabled && (
        <div className="flex items-center gap-2">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('write_comment_placeholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
          />
          <Button size="icon" onClick={handleSend} disabled={sending || !body.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
