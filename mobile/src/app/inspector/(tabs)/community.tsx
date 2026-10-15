import { router } from 'expo-router';
import { Megaphone, MessageSquare, Pin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { PillPicker } from '@/features/inspector/ui';
import { inspector, teacherInspections } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type Draft = { kind: 'broadcast' | 'thread'; title: string; body: string; targets: string[] };

/** Broadcasts and forum threads per assigned campus; send a broadcast or start a thread to chosen campuses (web: /inspector/community). */
export default function InspectorCommunity() {
  const { t } = useTranslation();
  const k = (key: string) => t(`inspections.community.${key}`);
  const toast = useToast();
  const schools = useApi(['inspector', 'schools'], () => inspector.mySchools());
  const list = schools.data ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const schoolId = picked ?? list[0]?.id ?? null;
  const feed = useApi(schoolId ? ['inspector', 'community', schoolId] : null, async ([, , s]) => {
    const [b, th] = await Promise.all([teacherInspections.broadcastsForSchool(s as string), teacherInspections.threadsForSchool(s as string)]);
    return { success: true as const, data: { broadcasts: b.data ?? [], threads: th.data ?? [] } };
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!draft || !draft.title.trim() || !draft.body.trim() || !draft.targets.length) return;
    setBusy(true);
    const body = { title: draft.title.trim(), body: draft.body.trim(), target_school_ids: draft.targets };
    const r = draft.kind === 'broadcast' ? await inspector.createBroadcast(body) : await inspector.createThread(body);
    setBusy(false);
    if (!r.success) return toast.error(r.error || t('common.error'));
    toast.success(draft.kind === 'broadcast' ? k('msg_broadcast_sent') : k('msg_thread_created'));
    setDraft(null);
    feed.mutate();
  }

  if (schools.isLoading) return <LoadingList rows={4} />;
  const broadcasts = feed.data?.broadcasts ?? [];
  const threads = feed.data?.threads ?? [];
  return (
    <>
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => feed.mutate()} />}>
        <Text variant="muted">{k('inspector_subtitle')}</Text>
        {!list.length ? (
          <Card>
            <CardContent className="py-10">
              <Text className="text-muted-foreground text-center text-sm">{k('no_assigned_campuses')}</Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <PillPicker items={list.map((s) => ({ value: s.id, label: s.name }))} value={schoolId} onChange={setPicked} />
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Icon as={Megaphone} className="size-4 text-[#022172] dark:text-blue-300" />
                  <CardTitle className="text-base">{k('broadcasts_title')}</CardTitle>
                </View>
                <Button size="sm" variant="outline" onPress={() => setDraft({ kind: 'broadcast', title: '', body: '', targets: [] })}>
                  <Icon as={Plus} className="size-3.5" />
                  <Text>{k('btn_new_broadcast')}</Text>
                </Button>
              </CardHeader>
              <CardContent className="gap-2">
                {feed.isLoading ? (
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
              <CardHeader className="flex-row items-center justify-between gap-2">
                <View className="flex-row items-center gap-2">
                  <Icon as={MessageSquare} className="size-4 text-[#022172] dark:text-blue-300" />
                  <CardTitle className="text-base">{k('forum_title')}</CardTitle>
                </View>
                <Button size="sm" variant="outline" onPress={() => setDraft({ kind: 'thread', title: '', body: '', targets: [] })}>
                  <Icon as={Plus} className="size-3.5" />
                  <Text>{k('btn_new_thread')}</Text>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {feed.isLoading ? null : !threads.length ? (
                  <Text className="text-muted-foreground px-4 pb-4 text-sm">{k('no_threads')}</Text>
                ) : (
                  threads.map((th, i) => (
                    <Pressable
                      key={th.id}
                      onPress={() => router.push({ pathname: '/inspector/community/[threadId]', params: { threadId: th.id } })}
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
          </>
        )}
      </ScrollView>
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[85vh] w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.kind === 'thread' ? k('dialog_new_thread') : k('dialog_new_broadcast')}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <ScrollView contentContainerClassName="gap-3" keyboardShouldPersistTaps="handled">
              <View className="gap-1.5">
                <Label>{k('field_title')}</Label>
                <Input value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} />
              </View>
              <View className="gap-1.5">
                <Label>{k('field_body')}</Label>
                <Textarea value={draft.body} onChangeText={(v) => setDraft({ ...draft, body: v })} numberOfLines={4} />
              </View>
              <View className="gap-1.5">
                <Label>{k('field_target_campuses')}</Label>
                {list.map((s) => {
                  const on = draft.targets.includes(s.id);
                  const toggle = () => setDraft({ ...draft, targets: on ? draft.targets.filter((x) => x !== s.id) : [...draft.targets, s.id] });
                  return (
                    <View key={s.id} className="flex-row items-center gap-2">
                      <Checkbox checked={on} onCheckedChange={toggle} />
                      <Text className="text-sm" onPress={toggle}>
                        {s.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          ) : null}
          <DialogFooter>
            <Button onPress={save} disabled={busy || !draft?.title.trim() || !draft?.body.trim() || !draft?.targets.length}>
              <Text>{draft?.kind === 'thread' ? k('btn_create') : k('btn_send')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
