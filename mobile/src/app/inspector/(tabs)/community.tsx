import { router } from 'expo-router';
import { Megaphone, MessageSquare, Pin, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { IconTile, RowItem, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
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
    if (!b.success) return { ...b, data: undefined };
    if (!th.success) return { ...th, data: undefined };
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
        <Text variant="muted" className="text-sm">
          {k('inspector_subtitle')}
        </Text>
        {!list.length ? (
          <EmptyState icon={MessageSquare} title={k('no_assigned_campuses')} />
        ) : (
          <>
            <PillPicker items={list.map((s) => ({ value: s.id, label: s.name }))} value={schoolId} onChange={setPicked} />
            <Panel>
              <View className="flex-row items-center gap-2.5 px-4 pb-2 pt-4">
                <IconTile icon={Megaphone} size={32} />
                <Text className="flex-1 text-base font-semibold">{k('broadcasts_title')}</Text>
                <RowPill icon={Plus} label={k('btn_new_broadcast')} onPress={() => setDraft({ kind: 'broadcast', title: '', body: '', targets: [] })} />
              </View>
              {feed.isLoading ? (
                <View className="px-4 pb-4">
                  <LoadingList rows={2} />
                </View>
              ) : feed.error ? (
                <View className="px-4 pb-4">
                  <ErrorState message={feed.error.message} onRetry={() => feed.mutate()} />
                </View>
              ) : !broadcasts.length ? (
                <Text className="text-muted-foreground px-4 pb-4 text-sm">{k('no_broadcasts')}</Text>
              ) : (
                broadcasts.map((b, i) => (
                  <View key={b.id} className={i < broadcasts.length - 1 ? 'border-info-soft dark:border-border gap-0.5 border-b px-4 py-3' : 'gap-0.5 px-4 py-3'}>
                    <Text className="text-sm font-semibold">{b.title}</Text>
                    <Text className="text-muted-foreground text-xs">{b.body}</Text>
                    <Text className="text-muted-foreground mt-1 text-[11px]">{`${b.inspector ? `${b.inspector.first_name} ${b.inspector.last_name} · ` : ''}${formatDateTime(b.created_at)}`}</Text>
                  </View>
                ))
              )}
            </Panel>
            <Panel>
              <View className="flex-row items-center gap-2.5 px-4 pb-2 pt-4">
                <IconTile icon={MessageSquare} tone="success" size={32} />
                <Text className="flex-1 text-base font-semibold">{k('forum_title')}</Text>
                <RowPill icon={Plus} label={k('btn_new_thread')} onPress={() => setDraft({ kind: 'thread', title: '', body: '', targets: [] })} />
              </View>
              {feed.isLoading || feed.error ? null : !threads.length ? (
                <Text className="text-muted-foreground px-4 pb-4 text-sm">{k('no_threads')}</Text>
              ) : (
                threads.map((th, i) => (
                  <RowItem
                    key={th.id}
                    title={th.title}
                    leading={th.is_pinned ? <Icon as={Pin} className="size-3.5 text-warning" /> : null}
                    onPress={() => router.push({ pathname: '/inspector/community/[threadId]', params: { threadId: th.id } })}
                    last={i === threads.length - 1}
                  />
                ))
              )}
            </Panel>
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
