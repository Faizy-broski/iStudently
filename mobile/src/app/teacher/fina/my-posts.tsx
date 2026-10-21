import type { FinaPost } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Newspaper, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { POST_TYPE_META } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const STATE_TONE: Record<string, ChipTone> = { published: 'success', blocked: 'destructive', rejected: 'destructive', restricted: 'warning', pending_auto: 'warning', pending_review: 'warning', pending_approval: 'warning' };

const STATE_KEY: Record<string, string> = {
  draft: 'status_draft',
  pending_auto: 'status_pending_auto',
  pending_review: 'status_pending_review',
  pending_approval: 'status_pending_approval',
  published: 'status_published',
  blocked: 'status_blocked',
  rejected: 'status_rejected',
  restricted: 'status_restricted',
  archived: 'status_draft',
};

/** The teacher's own Fina posts with their review state; drafts, rejected and blocked ones can be deleted (web: /teacher/fina/my-posts). */
export default function TeacherFinaMyPosts() {
  const { t } = useTranslation();
  const toast = useToast();
  const { campusId } = useCampus();
  const res = useApi(['teacher', 'fina-my-posts', campusId ?? 'school'], () => fina.myPosts(campusId ?? undefined));

  async function remove(p: FinaPost) {
    const r = await fina.deletePost(p.id, campusId ?? undefined);
    if (!r.success) return toast.error(r.error || t('common.error'));
    res.mutate();
  }

  const list = res.data ?? [];
  return (
    <>
      <Stack.Screen options={{ title: t('fina.composer.my_posts_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !list.length ? (
          <EmptyState icon={Newspaper} title={t('fina.composer.my_posts_empty')} />
        ) : (
          <Panel>
            {list.map((p, i) => {
              const meta = POST_TYPE_META[p.type];
              return (
                <View key={p.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <View className="size-10 items-center justify-center rounded-xl" style={{ backgroundColor: meta.bg }}>
                    <Icon as={meta.icon} size={16} color={meta.color} />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="text-xs font-semibold" style={{ color: meta.color }}>
                        {t(`fina.posts.type_${p.type}`)}
                      </Text>
                      <StatusChip label={t(`fina.composer.${STATE_KEY[p.state] ?? 'status_draft'}`)} tone={STATE_TONE[p.state] ?? 'muted'} />
                    </View>
                    {p.title ? <Text className="text-sm font-semibold">{p.title}</Text> : null}
                    {p.state === 'blocked' && p.blocked_reason ? <Text className="text-xs text-destructive">{t('fina.moderation.blocked_reason_label', { reason: p.blocked_reason })}</Text> : null}
                    {p.state === 'rejected' && p.rejected_reason ? <Text className="text-xs text-destructive">{t('fina.moderation.rejected_reason_label', { reason: p.rejected_reason })}</Text> : null}
                  </View>
                  {['draft', 'rejected', 'blocked'].includes(p.state) ? (
                    <Pressable onPress={() => remove(p)} hitSlop={4} accessibilityRole="button" accessibilityLabel={t('common.delete')} className="bg-destructive-soft size-9 items-center justify-center rounded-full active:opacity-70">
                      <Icon as={Trash2} className="text-destructive size-4" />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
