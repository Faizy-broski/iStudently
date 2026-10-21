import { router, Stack } from 'expo-router';
import { Megaphone, MessageSquare, Pin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { IconTile, RowItem, RowPill, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
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

/** Inspector broadcasts to the school and the inspection forum; start a thread (web: /teacher/inspections/community). */
export default function TeacherInspectionCommunity() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.community.${key}`);
  const toast = useToast();
  const { me } = useSession();
  const schoolId = me.status === 'ready' ? (me.me.profile.school_id ?? null) : null;
  const res = useApi(schoolId ? ['teacher', 'inspection-community', schoolId] : null, async ([, , s]) => {
    const [b, th] = await Promise.all([teacherInspections.broadcastsForSchool(s as string), teacherInspections.threadsForSchool(s as string)]);
    if (!b.success) return { ...b, data: undefined };
    if (!th.success) return { ...th, data: undefined };
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
        <Text variant="muted" className="text-sm">
          {k('teacher_subtitle')}
        </Text>
        <Section title={k('broadcasts_title')}>
          {res.isLoading ? (
            <LoadingList rows={2} />
          ) : res.error ? (
            <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
          ) : !broadcasts.length ? (
            <EmptyState icon={Megaphone} title={k('no_broadcasts')} />
          ) : (
            <Panel>
              {broadcasts.map((b, i) => (
                <RowItem
                  key={b.id}
                  leading={<IconTile icon={Megaphone} tone="warning" size={40} round />}
                  title={b.title}
                  meta={`${b.inspector ? `${b.inspector.first_name} ${b.inspector.last_name} · ` : ''}${formatDateTime(b.created_at)}`}
                  last={i === broadcasts.length - 1}>
                  <Text variant="muted" className="text-xs">
                    {b.body}
                  </Text>
                </RowItem>
              ))}
            </Panel>
          )}
        </Section>
        <View className="gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 text-base font-semibold">{k('forum_title')}</Text>
            <RowPill icon={Plus} label={k('btn_new_thread')} onPress={() => setForm({ title: '', body: '' })} />
          </View>
          {res.isLoading || res.error ? null : !threads.length ? (
            <EmptyState icon={MessageSquare} title={k('no_threads')} />
          ) : (
            <Panel>
              {threads.map((th, i) => (
                <RowItem
                  key={th.id}
                  onPress={() => router.push({ pathname: '/teacher/inspections/community/[threadId]', params: { threadId: th.id } })}
                  leading={<IconTile icon={th.is_pinned ? Pin : MessageSquare} tone={th.is_pinned ? 'warning' : 'brand'} size={40} round />}
                  title={th.title}
                  last={i === threads.length - 1}
                />
              ))}
            </Panel>
          )}
        </View>
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
