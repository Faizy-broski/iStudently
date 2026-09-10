'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pin, MessageCircle, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { setReaction, removeReaction, type FinaPost, type ReactionKind } from '@/lib/api/fina-posts'
import { useAuth } from '@/context/AuthContext'
import { POST_TYPE_META } from './postTypeMeta'
import { GatedMediaImage } from './GatedMediaImage'
import { CommentsSection } from './CommentsSection'
import { REACTION_LIST, SUPER_REACTION_ROLES, getReactionEmoji } from '@/lib/constants/reaction-config'

export function PostCard({ post }: { post: FinaPost }) {
  const t = useTranslations('fina')
  const { profile } = useAuth()
  const meta = POST_TYPE_META[post.type]
  const Icon = meta.icon
  const authorName = [post.author?.first_name, post.author?.last_name].filter(Boolean).join(' ')

  const [myReaction, setMyReaction] = useState<string | null>(post.myReaction)
  const [reactionCount, setReactionCount] = useState(post.reactionsCount)
  const [isSuperReaction, setIsSuperReaction] = useState(post.myReactionIsSuper)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [isHonorRoll, setIsHonorRoll] = useState(post.isHonorRoll)

  // Positive & Skill-Based Reaction Engine: teacher/admin/fina_supervisor
  // reactions are ALWAYS a 3x golden super-reaction — no toggle. This hint
  // makes that server-side-only effect visible before they pick, so it's
  // never an invisible mechanic.
  const iAmSuperReactor = !!profile && SUPER_REACTION_ROLES.includes(profile.role)

  const pickReaction = async (kind: ReactionKind) => {
    setPickerOpen(false)
    const wasReacted = !!myReaction
    setMyReaction(kind)
    setReactionCount((n) => (wasReacted ? n : n + 1))
    setIsSuperReaction(iAmSuperReactor)

    const res = await setReaction(post.id, kind)
    if (res.data?.promotedToHonorRoll) setIsHonorRoll(true)
  }

  const clearReaction = async () => {
    setPickerOpen(false)
    setMyReaction(null)
    setReactionCount((n) => Math.max(0, n - 1))
    setIsSuperReaction(false)
    await removeReaction(post.id)
  }

  const previewMedia = post.media.slice(0, 4)
  const extraCount = post.media.length - previewMedia.length

  return (
    <Card className={isSuperReaction ? 'shadow-gold border-yellow-400' : undefined}>
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
              {isHonorRoll && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                  <Sparkles className="h-3 w-3" />{t('wall.spotlight_badge')}
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
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={() => (myReaction ? setPickerOpen((o) => !o) : pickReaction('clap'))}
                className={`flex items-center gap-1.5 text-sm rounded-full px-2 py-1 -mx-2 -my-1 transition-colors ${
                  myReaction ? 'text-amber-700 bg-amber-50' : 'text-gray-500 hover:bg-gray-50'
                } ${isSuperReaction ? 'ring-1 ring-yellow-400 shadow-gold' : ''}`}
              >
                <span className="text-base leading-none">{getReactionEmoji(myReaction)}</span>
                {reactionCount}
                {isSuperReaction && <span className="text-[10px] font-bold text-yellow-600">×3</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="space-y-1.5">
                {iAmSuperReactor && (
                  <p className="text-[11px] text-yellow-700 font-medium flex items-center gap-1 px-1">
                    <Sparkles className="h-3 w-3" />{t('wall.super_reaction_hint')}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-1">
                  {REACTION_LIST.map((r) => (
                    <button
                      key={r.kind}
                      onClick={() => pickReaction(r.kind)}
                      title={t(`reactions.${r.i18nKey}`)}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-md p-2 hover:bg-gray-100 transition-colors ${
                        myReaction === r.kind ? 'bg-amber-50 ring-1 ring-amber-300' : ''
                      }`}
                    >
                      <span className="text-lg leading-none">{r.emoji}</span>
                    </button>
                  ))}
                </div>
                {myReaction && (
                  <button onClick={clearReaction} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 pt-1">
                    {t('wall.remove_reaction')}
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
