import { Stack, useLocalSearchParams } from 'expo-router';
import { MessagesSquare, Send } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { HeroCard, Initials } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDateTime } from '@/lib/format';

/** One forum thread with its posts and a reply box (web: /teacher/inspections/community/[threadId]). */
export default function TeacherForumThread() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.community.${key}`);
  const toast = useToast();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const res = useApi(threadId ? ['teacher', 'forum-thread', threadId] : null, ([, , id]) => teacherInspections.thread(id as string));
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const th = res.data;

  async function send() {
    if (!threadId || !reply.trim()) return;
    setBusy(true);
    const r = await teacherInspections.addPost(threadId, reply.trim());
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    setReply('');
    res.mutate();
  }

  if (res.isLoading) return <LoadingList rows={4} />;
  if (!th) return <EmptyState icon={MessagesSquare} title={k('thread_not_found')} />;
  return (
    <>
      <Stack.Screen options={{ title: th.title }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
          <HeroCard>
            <Text className="text-lg font-bold text-white">{th.title}</Text>
            {th.subject ? (
              <View className="self-start rounded-full bg-white/15 px-2.5 py-1">
                <Text className="text-[11px] font-semibold text-white">{th.subject.name}</Text>
              </View>
            ) : null}
          </HeroCard>
          {th.posts.map((p) => {
            const author = p.author ? `${p.author.first_name} ${p.author.last_name}` : '';
            return (
              <Panel key={p.id} className="gap-2 p-4">
                <View className="flex-row items-center gap-2.5">
                  <Initials name={author || '?'} tone={p.author?.role === 'inspector' ? 'warning' : 'brand'} size={32} />
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row flex-wrap items-center gap-1.5">
                      <Text className="text-sm font-semibold">{author}</Text>
                      {p.author?.role === 'inspector' ? <StatusChip label={k('inspector_badge')} tone="warning" /> : null}
                    </View>
                    <Text variant="muted" className="text-[11px]">
                      {formatDateTime(p.created_at)}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm">{p.body}</Text>
              </Panel>
            );
          })}
          <Panel className="gap-2 p-3">
            <Textarea value={reply} onChangeText={setReply} placeholder={k('field_reply_placeholder')} numberOfLines={3} />
            <Button size="sm" className="self-end rounded-full" onPress={send} disabled={busy || !reply.trim()}>
              <Icon flipRtl as={Send} className="text-primary-foreground size-4" />
              <Text>{k('btn_reply')}</Text>
            </Button>
          </Panel>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
