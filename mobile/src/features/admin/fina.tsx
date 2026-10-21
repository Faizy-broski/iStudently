import type { FinaComment, FinaMediaVariant, FinaPost, FinaPostType, FinaReactionKind } from '@studently/api-client';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import {
  AlarmClock,
  Backpack,
  BarChart3,
  Bell,
  BookOpen,
  Check,
  ImageOff,
  Megaphone,
  MessageCircle,
  PartyPopper,
  Pin,
  PinOff,
  Plus,
  Send,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { colors } from '@/lib/colors';
import { ScrollView } from '@/components/app/keyboard';
import { useConfirm } from '@/components/app/confirm';
import { IconTile, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';

/** `fina.<ns>.<key>` translator plus app keys. */
export function useFn(ns?: string) {
  const { t, i18n } = useTranslation();
  return {
    f: (k: string, o?: Record<string, unknown>) => t(ns ? `fina.${ns}.${k}` : `fina.${k}`, o),
    a: (k: string, o?: Record<string, unknown>) => t(`app.${k}`, o),
    t,
    lang: i18n.language,
  };
}

export function useFinaViewer() {
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  return { role: profile?.role ?? null, profileId: profile?.id ?? null };
}

export const isFinaKey = (k: unknown) => Array.isArray(k) && k[0] === 'admin' && typeof k[1] === 'string' && k[1].startsWith('fina-');

export const POST_TYPE_META: Record<FinaPostType, { icon: LucideIcon; color: string; bg: string }> = {
  activity: { icon: Backpack, color: colors.brand, bg: colors.infoSoft },
  announcement: { icon: Megaphone, color: colors.brand, bg: colors.infoSoft },
  achievement: { icon: Trophy, color: colors.warning, bg: colors.warningSoft },
  congratulation: { icon: PartyPopper, color: colors.chart8, bg: colors.printSurface },
  urgent: { icon: Zap, color: colors.destructive, bg: colors.destructiveSoft },
  resource: { icon: BookOpen, color: colors.success, bg: colors.successSoft },
  poll: { icon: BarChart3, color: colors.chart6, bg: colors.printSurface },
  reminder: { icon: AlarmClock, color: colors.warning, bg: colors.warningSoft },
};
export const POST_TYPES = Object.keys(POST_TYPE_META) as FinaPostType[];

export const REACTIONS: { kind: FinaReactionKind; emoji: string }[] = [
  { kind: 'thumbs_up', emoji: '👍' },
  { kind: 'clap', emoji: '👏' },
  { kind: 'bright_idea', emoji: '💡' },
  { kind: 'star', emoji: '🌟' },
  { kind: 'thinker', emoji: '🧠' },
  { kind: 'artistic', emoji: '🎨' },
  { kind: 'teamwork', emoji: '🤝' },
  { kind: 'bookworm', emoji: '📖' },
];
const emojiOf = (kind: string | null) => REACTIONS.find((r) => r.kind === kind)?.emoji ?? '👏';
/** Teacher/admin/supervisor reactions always count as a golden ×3 super-reaction (server-side). */
const SUPER_REACTION_ROLES = ['teacher', 'admin', 'super_admin', 'fina_supervisor'];

export const personName = (p?: { first_name: string | null; last_name: string | null } | null) => [p?.first_name, p?.last_name].filter(Boolean).join(' ');

/**
 * Every Fina image goes through here: the gated endpoints need the Bearer token and return a
 * per-viewer watermarked image, so it is fetched with headers and kept in memory only.
 */
export function GatedImage({ mediaId, variant = 'md', raw, thumb, className }: { mediaId: string; variant?: FinaMediaVariant; raw?: boolean; thumb?: boolean; className?: string }) {
  const { session } = useSession();
  const { campusId } = useCampus();
  const [failed, setFailed] = useState(false);
  const token = session?.access_token;
  const path = raw ? fina.rawMediaPath(mediaId, !!thumb, campusId) : fina.mediaPath(mediaId, variant, campusId);
  if (failed || !token) {
    return (
      <View className={cn('bg-muted items-center justify-center', className)}>
        <Icon as={ImageOff} className="text-muted-foreground size-5" />
      </View>
    );
  }
  return (
    <View className={cn('bg-muted overflow-hidden', className)}>
      <Image
        source={{ uri: `${env.apiUrl}${path}`, headers: { Authorization: `Bearer ${token}` } }}
        cachePolicy="memory"
        contentFit="cover"
        style={{ width: '100%', height: '100%' }}
        onError={() => setFailed(true)}
        transition={150}
      />
    </View>
  );
}

function Comments({ post }: { post: FinaPost }) {
  const { f, t } = useFn('wall');
  const toast = useToast();
  const { campusId } = useCampus();
  const { role, profileId } = useFinaViewer();
  const postId = post.id;
  const res = useApi(['admin', 'fina-comments', postId, campusId ?? 'school'], ([, , p]) => fina.comments(p as string, campusId));
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  // Moderators: admin / media officer, or the post's own author (super admin has no content access).
  const canModerate = (!!role && ['admin', 'media_officer'].includes(role)) || profileId === post.author_id;

  async function send() {
    if (!body.trim()) return;
    setBusy('send');
    try {
      const r = await fina.addComment(postId, body.trim(), campusId);
      if (!r.success) return toast.error(r.error || '');
      setBody('');
      if (r.data?.state === 'pending') toast.success(f('comment_pending_notice'));
      res.mutate();
    } finally {
      setBusy(null);
    }
  }
  async function moderate(c: FinaComment, decision: 'approve' | 'reject') {
    setBusy(c.id);
    try {
      const r = await fina.moderateComment(c.id, decision, campusId);
      if (!r.success) toast.error(r.error || '');
      else res.mutate();
    } finally {
      setBusy(null);
    }
  }

  const list = res.data ?? [];
  return (
    <View className="border-info-soft dark:border-border gap-2.5 border-t pt-3">
      {res.isLoading ? (
        <ActivityIndicator />
      ) : !list.length ? (
        <Text className="text-muted-foreground text-xs">{f('no_comments_yet')}</Text>
      ) : (
        list.map((c) => (
          <View key={c.id} className="bg-muted/50 flex-row items-start gap-2 rounded-xl px-3 py-2">
            <Text className="flex-1 text-sm">
              <Text className="text-sm font-semibold">{personName(c.author) || '—'}</Text> {c.body}
              {c.state === 'pending' ? <Text className="text-xs text-warning"> · {f('comment_pending_badge')}</Text> : null}
            </Text>
            {c.state === 'pending' && canModerate ? (
              <View className="flex-row gap-1">
                <Pressable onPress={() => moderate(c, 'approve')} disabled={busy === c.id} hitSlop={6} className="bg-success-soft size-8 items-center justify-center rounded-full active:opacity-70" accessibilityLabel={f('moderate_approve')}>
                  <Icon as={Check} className="size-4 text-success" />
                </Pressable>
                <Pressable onPress={() => moderate(c, 'reject')} disabled={busy === c.id} hitSlop={6} className="bg-destructive-soft size-8 items-center justify-center rounded-full active:opacity-70" accessibilityLabel={f('moderate_reject')}>
                  <Icon as={X} className="text-destructive size-4" />
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}
      {post.comments_enabled ? (
        <View className="flex-row items-center gap-2">
          <Input className="flex-1" value={body} onChangeText={setBody} placeholder={f('write_comment_placeholder')} returnKeyType="send" onSubmitEditing={send} />
          <Button size="icon" className="rounded-full" onPress={send} disabled={busy === 'send' || !body.trim()} accessibilityLabel={t('app.a11y_send')}>
            <Icon as={Send} className="text-primary-foreground size-4" />
          </Button>
        </View>
      ) : null}
    </View>
  );
}

/** One wall post: type, pin/spotlight badges, media, reactions, comments; admins can pin or delete (web: PostCard). */
export function PostCard({ post, onDeleted }: { post: FinaPost; onDeleted: (id: string) => void }) {
  const { f, t, lang } = useFn();
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const { role } = useFinaViewer();
  const meta = POST_TYPE_META[post.type];
  const postId = post.id;
  const [mine, setMine] = useState<string | null>(post.myReaction);
  const [count, setCount] = useState(post.reactionsCount);
  const [isSuper, setIsSuper] = useState(post.myReactionIsSuper);
  const [honor, setHonor] = useState(post.isHonorRoll);
  const [pinned, setPinned] = useState(post.is_pinned);
  const [picker, setPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const canModerate = role === 'admin';
  const superReactor = !!role && SUPER_REACTION_ROLES.includes(role);

  async function react(kind: FinaReactionKind) {
    setPicker(false);
    const prev = { mine, count, isSuper };
    setMine(kind);
    setCount((n) => (prev.mine ? n : n + 1));
    setIsSuper(superReactor);
    const r = await fina.setReaction(postId, kind, campusId);
    if (!r.success) {
      setMine(prev.mine);
      setCount(prev.count);
      setIsSuper(prev.isSuper);
      return toast.error(r.error || '');
    }
    if (r.data?.promotedToHonorRoll) setHonor(true);
  }
  async function clear() {
    setPicker(false);
    const prev = { mine, count, isSuper };
    setMine(null);
    setCount((n) => Math.max(0, n - 1));
    setIsSuper(false);
    const r = await fina.removeReaction(postId, campusId);
    if (!r.success) {
      setMine(prev.mine);
      setCount(prev.count);
      setIsSuper(prev.isSuper);
      toast.error(r.error || '');
    }
  }
  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    const r = await fina.pinPost(postId, next, campusId);
    if (!r.success) {
      setPinned(!next);
      toast.error(r.error || '');
    }
  }
  async function remove() {
    if (!(await confirm({ title: f('wall.delete_post_confirm_title'), body: f('wall.delete_post_confirm_desc'), destructive: true, confirmLabel: f('wall.delete_post') }))) return;
    const r = await fina.deletePost(postId, campusId);
    if (!r.success) return toast.error(r.error || '');
    toast.success(f('wall.delete_post_success'));
    onDeleted(postId);
  }

  const preview = post.media.slice(0, 4);
  const extra = post.media.length - preview.length;
  return (
    <Panel className="gap-3 p-4">
        <View className="flex-row items-start gap-3">
          <View className="size-10 items-center justify-center rounded-xl" style={{ backgroundColor: meta.bg }}>
            <Icon as={meta.icon} className="size-4" color={meta.color} />
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row flex-wrap items-center gap-2">
              {pinned ? (
                <View className="flex-row items-center gap-1">
                  <Icon as={Pin} className="text-muted-foreground size-3" />
                  <Text className="text-muted-foreground text-xs">{f('wall.pinned_label')}</Text>
                </View>
              ) : null}
              {honor ? (
                <View className="flex-row items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1">
                  <Icon as={Sparkles} className="size-3 text-warning" />
                  <Text className="text-[11px] font-semibold text-warning">{f('wall.spotlight_badge')}</Text>
                </View>
              ) : null}
              <Text className="text-xs font-semibold" style={{ color: meta.color }}>
                {f(`posts.type_${post.type}`)}
              </Text>
            </View>
            {post.title ? <Text className="text-sm font-semibold">{post.title}</Text> : null}
          </View>
          {canModerate ? (
            <View className="flex-row gap-2">
              <Pressable onPress={togglePin} hitSlop={4} className="bg-info-soft size-9 items-center justify-center rounded-full active:opacity-70" accessibilityLabel={pinned ? f('wall.unpin_post') : f('wall.pin_post')}>
                <Icon as={pinned ? PinOff : Pin} className="text-brand dark:text-brand-secondary size-4" />
              </Pressable>
              <Pressable onPress={remove} accessibilityLabel={f('wall.delete_post')} hitSlop={4} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                <Icon as={Trash2} className="text-destructive size-4" />
              </Pressable>
            </View>
          ) : null}
        </View>
        {post.body ? <Text className="text-sm">{post.body}</Text> : null}
        {preview.length ? (
          <View className="flex-row flex-wrap gap-1">
            {preview.map((m, i) => (
              <View key={m.id} className={cn('overflow-hidden rounded-xl', preview.length === 1 ? 'aspect-video w-full' : 'aspect-square w-[49%]')}>
                <GatedImage mediaId={m.id} variant="sm" className="size-full" />
                {i === preview.length - 1 && extra > 0 ? (
                  <View className="absolute inset-0 items-center justify-center bg-black/50">
                    <Text className="text-lg font-semibold text-white">+{extra}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <View className="flex-row items-center gap-3">
          <Text className="text-muted-foreground flex-1 text-xs">
            {personName(post.author)}
            {post.published_at ? ` · ${new Date(post.published_at).toLocaleDateString(lang)}` : ''}
          </Text>
          <Pressable
            onPress={() => (mine ? setPicker((p) => !p) : react('clap'))}
            onLongPress={() => setPicker(true)}
            className={cn('flex-row items-center gap-1 rounded-full px-2.5 py-1', mine ? 'bg-warning-soft' : 'bg-muted', isSuper && 'border border-warning')}>
            <Text>{emojiOf(mine)}</Text>
            <Text className={cn('text-sm', mine && 'text-warning ')}>{count}</Text>
            {isSuper ? <Text className="text-xs font-bold text-warning">×3</Text> : null}
          </Pressable>
          {post.comments_enabled ? (
            <Pressable onPress={() => setShowComments((s) => !s)} className="bg-muted flex-row items-center gap-1 rounded-full px-2.5 py-1 active:opacity-70" hitSlop={6}>
              <Icon as={MessageCircle} className="text-muted-foreground size-4" />
              <Text className="text-muted-foreground text-sm">{post.commentsCount}</Text>
            </Pressable>
          ) : null}
        </View>
        {picker ? (
          <View className="border-info-soft dark:border-border bg-card gap-2 rounded-2xl border p-2">
            {superReactor ? (
              <View className="flex-row items-center gap-1">
                <Icon as={Sparkles} className="size-3 text-warning" />
                <Text className="text-xs text-warning ">{f('wall.super_reaction_hint')}</Text>
              </View>
            ) : null}
            <View className="flex-row flex-wrap justify-between">
              {REACTIONS.map((r) => (
                <Pressable key={r.kind} onPress={() => react(r.kind)} accessibilityLabel={t(`fina.reactions.${r.kind}`)} className={cn('rounded-xl p-2', mine === r.kind && 'bg-warning-soft')}>
                  <Text className="text-xl">{r.emoji}</Text>
                </Pressable>
              ))}
            </View>
            {mine ? (
              <Pressable onPress={clear}>
                <Text className="text-muted-foreground text-center text-xs">{f('wall.remove_reaction')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {showComments && post.comments_enabled ? <Comments post={post} /> : null}
    </Panel>
  );
}

/** Active stories as a horizontal row; tap opens the large image (web: StoriesBar). */
export function StoriesBar() {
  const { f } = useFn('stories');
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-stories', campusId ?? 'school'], () => fina.stories(campusId));
  const [viewing, setViewing] = useState<string | null>(null);
  const list = res.data ?? [];
  if (!list.length) return null;
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {list.map((s) => (
          <Pressable key={s.id} onPress={() => setViewing(s.media_id)} className="w-16 items-center gap-1">
            <View className="size-16 overflow-hidden rounded-full border-2 border-brand-secondary">
              <GatedImage mediaId={s.media_id} variant="thumb" className="size-full" />
            </View>
            <Text className="text-[11px] font-medium" numberOfLines={1}>
              {s.author?.first_name || f('story')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="w-[94vw] max-w-md p-2">{viewing ? <GatedImage mediaId={viewing} variant="lg" className="aspect-[3/4] w-full rounded-xl" /> : null}</DialogContent>
      </Dialog>
    </>
  );
}

/** Weekly reaction goals per class with an inline create form; teacher/admin only (web: ClassGoalsWidget). */
export function ClassGoals() {
  const { f, t } = useFn('wall');
  const toast = useToast();
  const { campusId } = useCampus();
  const goals = useApi(['admin', 'fina-goals', campusId ?? 'school'], () => fina.classGoals(campusId));
  const opts = useApi(['admin', 'fina-composer-options', campusId ?? 'school'], () => fina.composerOptions(campusId));
  const [open, setOpen] = useState(false);
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [kind, setKind] = useState<FinaReactionKind>('star');
  const [target, setTarget] = useState('100');
  const [saving, setSaving] = useState(false);
  const grades = opts.data?.gradeLevels ?? [];
  const sections = opts.data?.sections ?? [];
  const sectionsForGrade = grade ? sections.filter((s) => s.gradeLevelId === grade) : sections;

  async function create() {
    const n = Number(target);
    if (!grade || !(n > 0)) return;
    setSaving(true);
    try {
      // Section is optional: a grade alone targets every section under it.
      const r = await fina.createClassGoal(section ? { sectionId: section, reactionKind: kind, targetCount: n } : { gradeLevelId: grade, reactionKind: kind, targetCount: n }, campusId);
      if (!r.success) return toast.error(r.error || '');
      setOpen(false);
      goals.mutate();
    } finally {
      setSaving(false);
    }
  }

  const list = goals.data ?? [];
  return (
    <Panel className="gap-3 p-4">
        <View className="flex-row items-center gap-2.5">
          <IconTile icon={Target} size={32} />
          <Text className="flex-1 font-semibold">{f('class_goals_title')}</Text>
          <RowPill icon={Plus} label={f('class_goal_create')} onPress={() => setOpen((o) => !o)} />
        </View>
        {open ? (
          <View className="bg-muted/50 gap-2 rounded-2xl p-3">
            <Picker
              value={grade}
              onChange={(v) => {
                setGrade(v);
                setSection('');
              }}
              placeholder={f('class_goal_grade_placeholder')}
              options={grades.map((g) => ({ value: g.id, label: g.name }))}
            />
            {grade && sectionsForGrade.length ? (
              <Picker value={section} onChange={setSection} placeholder={f('class_goal_section_optional_placeholder')} options={sectionsForGrade.map((s) => ({ value: s.id, label: s.name }))} />
            ) : grade ? (
              <Text className="text-muted-foreground text-xs">{f('class_goal_whole_grade')}</Text>
            ) : null}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Picker value={kind} onChange={(v) => setKind(v as FinaReactionKind)} options={REACTIONS.map((r) => ({ value: r.kind, label: `${r.emoji} ${t(`fina.reactions.${r.kind}`)}` }))} />
              </View>
              <Input className="w-24" value={target} onChangeText={(v) => setTarget(v.replace(/\D/g, ''))} keyboardType="number-pad" />
            </View>
            <Button size="sm" onPress={create} disabled={saving || !grade}>
              <Text>{f('class_goal_create')}</Text>
            </Button>
          </View>
        ) : null}
        {goals.data && !list.length ? <Text className="text-muted-foreground text-xs">{f('class_goals_empty')}</Text> : null}
        {list.map((g) => {
          const emoji = emojiOf(g.reaction_kind);
          const pct = Math.min(100, Math.round((g.currentCount / Math.max(1, g.target_count)) * 100));
          const reached = g.currentCount >= g.target_count;
          const where = g.section_id ? (sections.find((s) => s.id === g.section_id)?.name ?? g.section_id) : (grades.find((x) => x.id === g.grade_level_id)?.name ?? g.grade_level_id);
          return (
            <View key={g.id} className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm" numberOfLines={1}>
                  {where} · {emoji} {t(`fina.reactions.${g.reaction_kind}`)}
                </Text>
                <Text className="text-muted-foreground text-xs font-semibold">
                  {g.currentCount}/{g.target_count}
                </Text>
              </View>
              <View className="bg-muted h-1.5 overflow-hidden rounded-full">
                <View className={cn('h-full rounded-full', reached ? 'bg-success' : 'bg-warning')} style={{ width: `${pct}%` }} />
              </View>
              {reached ? <Text className="text-xs font-medium text-success">{f('class_goal_target_reached')}</Text> : null}
            </View>
          );
        })}
    </Panel>
  );
}

/** Header bell with the unread count; opens the notifications screen (web: NotificationBell). */
export function NotificationBell({ href = '/admin/fina/notifications' }: { href?: Href } = {}) {
  const { a } = useFn();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-unread', campusId ?? 'school'], () => fina.unreadCount(campusId), { refreshInterval: 30_000 });
  const unread = res.data?.count ?? 0;
  return (
    <Pressable onPress={() => router.push(href)} hitSlop={8} className="p-1" accessibilityLabel={a('fn_notifications')}>
      <Icon as={Bell} className="text-brand dark:text-brand-secondary size-5" />
      {unread > 0 ? (
        <View className="bg-destructive absolute -end-0.5 -top-0.5 min-w-4 items-center rounded-full px-1">
          <Text className="text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Notification text by type (web: formatBody). */
export function notificationText(t: (k: string, o?: Record<string, unknown>) => string, n: { type: string; payload: Record<string, unknown> }) {
  switch (n.type) {
    case 'absence':
      return t('fina.notifications.body_absence', { name: n.payload?.studentName ?? '', date: n.payload?.date ?? '' });
    case 'new_post':
      return t('fina.notifications.body_new_post');
    case 'consent_withdrawn':
      return t('fina.notifications.body_consent_withdrawn');
    case 'publish_blocked':
      return t('fina.notifications.body_publish_blocked');
    default:
      return t('fina.notifications.body_generic');
  }
}
