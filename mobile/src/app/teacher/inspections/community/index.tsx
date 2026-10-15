import { router, Stack } from 'expo-router';
import { Megaphone, MessageSquare, Pin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/features/auth/session';
import { teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Inspector broadcasts to the school and the inspection forum; start a thread (web: /teacher/inspections/community). */
export default function TeacherInspectionCommunity() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.community.${key}`);
  const toast = useToast();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const res = useApi(schoolId ? ['teacher', 'inspection-community', schoolId] : null, async ([, , s]) => {
    const [b, th] = await Promise.all([teacherInspections.broadcastsForSchool(s as string), teacherInspections.threadsForSchool(s as string)]);
    return { success: true as const, data: { broadcasts: b.data ?? [], threads: th.data ?? [] } };
  });
  const [form, setForm] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const broadcasts = res.data?.broadcasts ?? [];
  const threads = res.data?.threads ?? [];

  async function create() {
    if (!form || !form.title.trim() || !form.body.trim()) return;
    setBusy(true);
    const r = await teacherInspections.createThread({ title: form.title.trim(), body: form.body.trim() });
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(k('msg_thread_created'));
    setForm(null);
    res.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted">{k('teacher_subtitle')}</Text>
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Icon as={Megaphone} className="size-4 text-[#022172] dark:text-blue-300" />
              <CardTitle className="text-base">{k('broadcasts_title')}</CardTitle>
            </View>
          </CardHeader>
          <CardContent className="gap-2">
            {res.isLoading ? (
              <LoadingList rows={2} />
            ) : !broadcasts.length ? (
              <Text className="text-muted-foreground text-sm">{k('no_broadcasts')}</Text>
            ) : (
              broadcasts.map((b) => (
                <View key={b.id} className="border-border rounded-md border p-2.5">
                  <Text className="text-sm font-medium">{b.title}</Text>
                  <Text className="text-muted-foreground text-xs">{b.body}</Text>
                  <Text className="text-muted-foreground mt-1 text-[11px]">{`${b.inspector ? `${b.inspector.first_name} ${b.inspector.last_name} · ` : ''}${formatDateTime(b.created_at)}`}</Text>
                </View>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                <Icon as={MessageSquare} className="size-4 text-[#022172] dark:text-blue-300" />
                <CardTitle className="text-base">{k('forum_title')}</CardTitle>
              </View>
              <Button size="sm" variant="outline" onPress={() => setForm({ title: '', body: '' })}>
                <Icon as={Plus} className="size-3.5" />
                <Text>{k('btn_new_thread')}</Text>
              </Button>
            </View>
          </CardHeader>
          <CardContent className="p-0">
            {res.isLoading ? null : !threads.length ? (
              <Text className="text-muted-foreground px-4 pb-4 text-sm">{k('no_threads')}</Text>
            ) : (
              threads.map((th, i) => (
                <Pressable
                  key={th.id}
                  onPress={() => router.push({ pathname: '/teacher/inspections/community/[threadId]', params: { threadId: th.id } })}
                  accessibilityRole="button"
                  className={cn('flex-row items-center gap-2 px-4 py-3', i > 0 && 'border-border border-t')}>
                  {th.is_pinned ? <Icon as={Pin} className="size-3.5 text-amber-500" /> : null}
                  <Text className="flex-1 text-sm" numberOfLines={1}>
                    {th.title}
                  </Text>
                </Pressable>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{k('dialog_new_thread')}</DialogTitle>
          </DialogHeader>
          {form ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{k('field_title')}</Label>
                <Input value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{k('field_body')}</Label>
                <Textarea value={form.body} onChangeText={(v) => setForm({ ...form, body: v })} numberOfLines={4} />
              </View>
            </View>
          ) : null}
          <DialogFooter>
            <Button onPress={create} disabled={busy || !form?.title.trim() || !form?.body.trim()}>
              <Icon as={Plus} className="text-primary-foreground size-4" />
              <Text>{k('btn_create')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
