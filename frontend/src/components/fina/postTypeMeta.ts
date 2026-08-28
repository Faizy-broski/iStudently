import { Backpack, Megaphone, Trophy, PartyPopper, Zap, BookOpen, BarChart3, AlarmClock, type LucideIcon } from 'lucide-react'
import type { PostType } from '@/lib/api/fina-posts'

/** Fixed icon + colour per post type (spec §17) — never derived, never a
 * "free"/"other" fallback since that post type doesn't exist. */
export const POST_TYPE_META: Record<PostType, { icon: LucideIcon; color: string; bg: string }> = {
  activity: { icon: Backpack, color: '#1d4ed8', bg: '#eff6ff' },
  announcement: { icon: Megaphone, color: '#1e3a8a', bg: '#eef2ff' },
  achievement: { icon: Trophy, color: '#b45309', bg: '#fffbeb' },
  congratulation: { icon: PartyPopper, color: '#be185d', bg: '#fdf2f8' },
  urgent: { icon: Zap, color: '#b91c1c', bg: '#fef2f2' },
  resource: { icon: BookOpen, color: '#15803d', bg: '#f0fdf4' },
  poll: { icon: BarChart3, color: '#7e22ce', bg: '#faf5ff' },
  reminder: { icon: AlarmClock, color: '#c2410c', bg: '#fff7ed' },
}

export const POST_TYPES: PostType[] = ['activity', 'announcement', 'achievement', 'congratulation', 'urgent', 'resource', 'poll', 'reminder']
