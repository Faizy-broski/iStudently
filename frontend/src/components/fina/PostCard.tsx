'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pin, MessageCircle, Heart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { setReaction, removeReaction, type FinaPost } from '@/lib/api/fina-posts'
import { POST_TYPE_META } from './postTypeMeta'
import { GatedMediaImage } from './GatedMediaImage'
import { CommentsSection } from './CommentsSection'

export function PostCard({ post }: { post: FinaPost }) {
  const t = useTranslations('fina')
  const meta = POST_TYPE_META[post.type]
  const Icon = meta.icon
  const authorName = [post.author?.first_name, post.author?.last_name].filter(Boolean).join(' ')

  const [reacted, setReacted] = useState(!!post.myReaction)
  const [reactionCount, setReactionCount] = useState(post.reactionsCount)
  const [showComments, setShowComments] = useState(false)

  const toggleReaction = async () => {
    if (reacted) {
      setReacted(false)
      setReactionCount((n) => Math.max(0, n - 1))
      await removeReaction(post.id)
    } else {
      setReacted(true)
      setReactionCount((n) => n + 1)
      await setReaction(post.id, 'clap')
    }
  }

  const previewMedia = post.media.slice(0, 4)
  const extraCount = post.media.length - previewMedia.length

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-2">
          <span className="flex items-center justify-center h-8 w-8 rounded-full shrink-0" style={{ backgroundColor: meta.bg }}>
            <Icon className="h-4 w-4" style={{ color: meta.color }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                  <Pin className="h-3 w-3" />{t('wall.pinned_label')}
                </span>
              )}
              <span className="text-xs font-medium" style={{ color: meta.color }}>{t(`posts.type_${post.type}`)}</span>
            </div>
            {post.title && <h3 className="font-semibold text-gray-900 mt-0.5">{post.title}</h3>}
          </div>
        </div>

        {post.body && <p className="text-sm text-gray-700 whitespace-pre-wrap">{post.body}</p>}

        {previewMedia.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {previewMedia.map((m, i) => (
              <div key={m.id} className="relative aspect-square rounded-md overflow-hidden bg-gray-50">
                <GatedMediaImage mediaId={m.id} variant="sm" alt={post.title || ''} className="w-full h-full object-cover" />
                {i === previewMedia.length - 1 && extraCount > 0 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold">
                    +{extraCount}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{authorName}{post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString()}` : ''}</span>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button onClick={toggleReaction} className={`flex items-center gap-1.5 text-sm ${reacted ? 'text-rose-600' : 'text-gray-500'}`}>
            <Heart className={`h-4 w-4 ${reacted ? 'fill-rose-600' : ''}`} />
            {reactionCount}
          </button>
          {post.comments_enabled && (
            <button onClick={() => setShowComments((s) => !s)} className="flex items-center gap-1.5 text-sm text-gray-500">
              <MessageCircle className="h-4 w-4" />
              {post.commentsCount}
            </button>
          )}
        </div>

        {showComments && post.comments_enabled && (
          <CommentsSection postId={post.id} postAuthorId={post.author_id} commentsEnabled={post.comments_enabled} />
        )}
      </CardContent>
    </Card>
  )
}
