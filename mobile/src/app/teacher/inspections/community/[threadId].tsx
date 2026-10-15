import { Stack, useLocalSearchParams } from 'expo-router';
import { Send, User } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { KeyboardAvoidingView, ScrollView } from '@/components/app/keyboard';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  if (!th) return <Text className="text-muted-foreground p-6 text-center">{k('thread_not_found')}</Text>;
  return (
    <>
      <Stack.Screen options={{ title: th.title }} />
      <KeyboardAvoidingView className="bg-background flex-1">
        <ScrollView contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
          <Card>
            <CardContent className="gap-2 p-4">
              <Text className="text-lg font-semibold">{th.title}</Text>
              {th.subject ? (
                <Badge variant="outline" className="self-start">
                  <Text className="text-xs">{th.subject.name}</Text>
                </Badge>
              ) : null}
            </CardContent>
          </Card>
          {th.posts.map((p) => (
            <Card key={p.id}>
              <CardContent className="gap-2 p-3">
                <View className="flex-row items-center gap-2">
                  <View className="size-7 items-center justify-center rounded-full bg-[#022172]/10">
                    <Icon as={User} className="size-3.5 text-[#022172] dark:text-blue-300" />
                  </View>
                  <Text className="text-sm font-medium">{p.author ? `${p.author.first_name} ${p.author.last_name}` : ''}</Text>
                  {p.author?.role === 'inspector' ? (
                    <Badge variant="secondary">
                      <Text className="text-[10px]">{k('inspector_badge')}</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-muted-foreground ms-auto text-xs">{formatDateTime(p.created_at)}</Text>
                </View>
                <Text className="text-sm">{p.body}</Text>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="gap-2 p-3">
              <Textarea value={reply} onChangeText={setReply} placeholder={k('field_reply_placeholder')} numberOfLines={3} />
              <Button size="sm" className="self-end" onPress={send} disabled={busy || !reply.trim()}>
                <Icon as={Send} className="text-primary-foreground size-4 rtl:-scale-x-100" />
                <Text>{k('btn_reply')}</Text>
              </Button>
            </CardContent>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
