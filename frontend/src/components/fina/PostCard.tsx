'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Pin, MessageCircle, Sparkles, MoreVertical, PinOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { setReaction, removeReaction, deletePost, pinPost, type FinaPost, type ReactionKind } from '@/lib/api/fina-posts'
import { useAuth } from '@/context/AuthContext'
import { POST_TYPE_META } from './postTypeMeta'
import { GatedMediaImage } from './GatedMediaImage'
import { CommentsSection } from './CommentsSection'
import { REACTION_LIST, SUPER_REACTION_ROLES, getReactionEmoji } from '@/lib/constants/reaction-config'

export function PostCard({ post, onDeleted }: { post: FinaPost; onDeleted?: (postId: string) => void }) {
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
  const [isPinned, setIsPinned] = useState(post.is_pinned)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Only an admin (the "principal" role, per moderation.service.ts#PRINCIPAL_ROLES) can
  // remove or pin an already-published post from the wall — matches the backend check
  // exactly, so this menu never offers an action the API would then reject.
  const canModerate = profile?.role === 'admin'

  const togglePin = async () => {
    const next = !isPinned
    setIsPinned(next) // optimistic
    const res = await pinPost(post.id, next)
    if (res.error) {
      setIsPinned(!next) // revert
      toast.error(res.error)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const res = await deletePost(post.id)
    setDeleting(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setDeleteDialogOpen(false)
    toast.success(t('wall.delete_post_success'))
    onDeleted?.(post.id)
  }

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
              {isPinned && (
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
          {canModerate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={t('wall.post_options')}
                  className="shrink-0 text-gray-400 hover:text-gray-600 rounded-md p-1 -m-1 hover:bg-gray-50"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={togglePin}>
                  {isPinned ? (
                    <><PinOff className="h-4 w-4" />{t('wall.unpin_post')}</>
                  ) : (
                    <><Pin className="h-4 w-4" />{t('wall.pin_post')}</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />{t('wall.delete_post')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wall.delete_post_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('wall.delete_post_confirm_desc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t('wall.delete_post_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('wall.delete_post')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
