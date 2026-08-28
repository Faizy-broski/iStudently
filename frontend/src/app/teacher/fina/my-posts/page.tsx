'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listMyPosts, deletePost, type FinaPost, type PostState } from '@/lib/api/fina-posts'
import { POST_TYPE_META } from '@/components/fina/postTypeMeta'

const STATE_KEY: Record<PostState, string> = {
  draft: 'status_draft', pending_auto: 'status_pending_auto', pending_review: 'status_pending_review',
  pending_approval: 'status_pending_approval', published: 'status_published', blocked: 'status_blocked',
  rejected: 'status_rejected', restricted: 'status_restricted', archived: 'status_draft',
}

export default function TeacherFinaMyPostsPage() {
  const t = useTranslations('fina.composer')
  const tp = useTranslations('fina.posts')
  const tm = useTranslations('fina.moderation')
  const [posts, setPosts] = useState<FinaPost[] | null>(null)

  const load = useCallback(() => { listMyPosts().then((res) => setPosts((res.data as FinaPost[]) ?? [])) }, [])
  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    const res = await deletePost(id)
    if (res.error) toast.error(res.error)
    else load()
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-gray-900">{t('my_posts_title')}</h1>

      {posts === null ? (
        <Skeleton className="h-24 w-full" />
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-500">{t('my_posts_empty')}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const meta = POST_TYPE_META[post.type]
            const Icon = meta.icon
            return (
              <Card key={post.id}>
                <CardContent className="py-3 flex items-start gap-3">
                  <span className="flex items-center justify-center h-8 w-8 rounded-full shrink-0" style={{ backgroundColor: meta.bg }}>
                    <Icon className="h-4 w-4" style={{ color: meta.color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: meta.color }}>{tp(`type_${post.type}`)}</span>
                      <span className="text-xs text-gray-400">· {t(STATE_KEY[post.state])}</span>
                    </div>
                    {post.title && <div className="font-medium text-gray-900 text-sm">{post.title}</div>}
                    {post.state === 'blocked' && post.blocked_reason && (
                      <div className="text-xs text-red-600 mt-1">{tm('blocked_reason_label', { reason: post.blocked_reason })}</div>
                    )}
                    {post.state === 'rejected' && post.rejected_reason && (
                      <div className="text-xs text-red-600 mt-1">{tm('rejected_reason_label', { reason: post.rejected_reason })}</div>
                    )}
                  </div>
                  {['draft', 'rejected', 'blocked'].includes(post.state) && (
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(post.id)}>
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
