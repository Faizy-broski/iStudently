import type { FinaPost } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { POST_TYPE_META } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';

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
          <Card>
            <CardContent className="py-10">
              <Text className="text-muted-foreground text-center text-sm">{t('fina.composer.my_posts_empty')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((p) => {
            const meta = POST_TYPE_META[p.type];
            return (
              <Card key={p.id}>
                <CardContent className="flex-row items-start gap-3 py-3">
                  <View className="size-8 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
                    <Icon as={meta.icon} size={16} color={meta.color} />
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-xs">
                      <Text className="text-xs font-medium" style={{ color: meta.color }}>
                        {t(`fina.posts.type_${p.type}`)}
                      </Text>
                      <Text className="text-muted-foreground text-xs">{` · ${t(`fina.composer.${STATE_KEY[p.state] ?? 'status_draft'}`)}`}</Text>
                    </Text>
                    {p.title ? <Text className="text-sm font-medium">{p.title}</Text> : null}
                    {p.state === 'blocked' && p.blocked_reason ? <Text className="text-xs text-red-600">{t('fina.moderation.blocked_reason_label', { reason: p.blocked_reason })}</Text> : null}
                    {p.state === 'rejected' && p.rejected_reason ? <Text className="text-xs text-red-600">{t('fina.moderation.rejected_reason_label', { reason: p.rejected_reason })}</Text> : null}
                  </View>
                  {['draft', 'rejected', 'blocked'].includes(p.state) ? (
                    <Pressable onPress={() => remove(p)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.delete')}>
                      <Icon as={Trash2} className="text-muted-foreground size-4" />
                    </Pressable>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
