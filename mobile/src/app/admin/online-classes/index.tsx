import type { OnlineClassRequest } from '@studently/api-client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { CalendarClock, CheckCircle2, StopCircle, Users, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useCampus } from '@/features/campus/campus';
import { adminOnlineClasses } from '@/lib/api';
import { useApi } from '@/lib/data';

type Tab = 'queue' | 'active';

/**
 * Online class requests waiting for review (approve, reject with a note) and live sessions (end)
 * (web: /admin/online-classes and /admin/online-classes/active).
 */
export default function OnlineClasses() {
  const { t } = useTranslation();
  const o = (k: string) => t(`online_classes.${k}`);
  const params = useLocalSearchParams<{ tab?: string }>();
  const { campusId } = useCampus();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>(params.tab === 'active' ? 'active' : 'queue');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<OnlineClassRequest | null>(null);
  const [note, setNote] = useState('');
  const queue = useApi(['admin', 'oc-review-queue', campusId ?? 'school'], () => adminOnlineClasses.reviewQueue(campusId));
  const sessions = useApi(['admin', 'oc-active-sessions', campusId ?? 'school'], () => adminOnlineClasses.activeSessions(campusId));

  async function review(r: OnlineClassRequest, action: 'approve' | 'reject', withNote?: string) {
    setBusy(r.id);
    const res = action === 'approve' ? await adminOnlineClasses.approve(r.id, withNote) : await adminOnlineClasses.reject(r.id, withNote);
    setBusy(null);
    if (!res.success) return toast.error(res.error || t('app.error_title'));
    toast.success(o(action === 'approve' ? 'msg_approved' : 'msg_rejected'));
    setRejecting(null);
    setNote('');
    queue.mutate();
    sessions.mutate();
  }

  async function end(s: OnlineClassRequest) {
    if (!(await confirm({ title: o('end_session'), body: s.title, destructive: true, confirmLabel: o('end_session') }))) return;
    setBusy(s.id);
    const res = await adminOnlineClasses.endSession(s.id);
    setBusy(null);
    if (!res.success) return toast.error(res.error || o('msg_end_failed'));
    toast.success(o('msg_ended'));
    sessions.mutate();
  }

  const mode = (r: OnlineClassRequest) => o(r.class_type === 'existing_course' ? 'mode_existing_title' : 'mode_external_title');

  return (
    <>
      <Stack.Screen options={{ title: tab === 'queue' ? o('review_queue') : o('active_sessions_title') }} />
      <View className="bg-background flex-1">
        <View className="gap-2 px-4 pt-3 pb-1">
          <FilterChips<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'queue', label: o('review_queue') },
              { value: 'active', label: o('active_sessions_title') },
            ]}
          />
          <Text variant="muted">{tab === 'queue' ? o('admin_subtitle') : o('active_sessions_subtitle')}</Text>
        </View>

        {tab === 'queue' ? (
          <DataList<OnlineClassRequest>
            items={queue.data}
            error={queue.error}
            isLoading={queue.isLoading}
            isRefreshing={queue.isValidating && !queue.isLoading}
            onRefresh={() => queue.mutate()}
            emptyTitle={o('no_pending_requests')}
            keyExtractor={(r) => r.id}
            ItemSeparatorComponent={null}
            contentContainerClassName="flex-grow gap-3 p-4"
            renderItem={(r) => (
              <Card className="py-3">
                <CardContent className="gap-2 px-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-semibold">{r.title}</Text>
                      <Text className="text-muted-foreground text-xs">{mode(r)}</Text>
                    </View>
                    <Badge variant="secondary">
                      <Text>{o('status_pending_review')}</Text>
                    </Badge>
                  </View>
                  {r.description ? <Text className="text-muted-foreground text-sm">{r.description}</Text> : null}
                  <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                    {r.scheduled_days ? (
                      <View className="flex-row items-center gap-1">
                        <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                        <Text className="text-muted-foreground text-xs">
                          {`${r.scheduled_days} ${r.session_start_time ?? ''}${r.session_end_time ? `–${r.session_end_time}` : ''}`}
                        </Text>
                      </View>
                    ) : null}
                    {r.class_type === 'external_open' ? (
                      <View className="flex-row items-center gap-1">
                        <Icon as={Users} className="text-muted-foreground size-3.5" />
                        <Text className="text-muted-foreground text-xs">{`${o('capacity_label')}: ${r.student_capacity ?? '—'}`}</Text>
                      </View>
                    ) : null}
                    {r.start_date || r.end_date ? <Text className="text-muted-foreground text-xs">{`${r.start_date || '—'} → ${r.end_date || '—'}`}</Text> : null}
                  </View>
                  <View className="flex-row gap-2">
                    <Button size="sm" className="flex-1" disabled={busy === r.id} onPress={() => review(r, 'approve')}>
                      <Icon as={CheckCircle2} className="text-primary-foreground size-4" />
                      <Text>{o('approve')}</Text>
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" disabled={busy === r.id} onPress={() => setRejecting(r)}>
                      <Icon as={XCircle} className="size-4" />
                      <Text>{o('reject')}</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            )}
          />
        ) : (
          <DataList<OnlineClassRequest>
            items={sessions.data}
            error={sessions.error}
            isLoading={sessions.isLoading}
            isRefreshing={sessions.isValidating && !sessions.isLoading}
            onRefresh={() => sessions.mutate()}
            emptyTitle={o('no_active_sessions')}
            keyExtractor={(s) => s.id}
            ItemSeparatorComponent={null}
            contentContainerClassName="flex-grow gap-3 p-4"
            renderItem={(s) => (
              <Card className="py-3">
                <CardContent className="gap-2 px-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-semibold">{s.title}</Text>
                      <Text className="text-muted-foreground text-xs">{mode(s)}</Text>
                    </View>
                    <Badge className="bg-green-600">
                      <Text>{o('status_active')}</Text>
                    </Badge>
                  </View>
                  {s.started_at ? (
                    <View className="flex-row items-center gap-1">
                      <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                      <Text className="text-muted-foreground text-sm">{`${o('started_label')}: ${new Date(s.started_at).toLocaleString()}`}</Text>
                    </View>
                  ) : null}
                  <Button size="sm" variant="outline" className="self-start" disabled={busy === s.id} onPress={() => end(s)}>
                    <Icon as={StopCircle} className="text-destructive size-4" />
                    <Text className="text-destructive">{o('end_session')}</Text>
                  </Button>
                </CardContent>
              </Card>
            )}
          />
        )}
      </View>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && (setRejecting(null), setNote(''))}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>{o('reject')}</DialogTitle>
          </DialogHeader>
          <Label>{o('review_note_label')}</Label>
          <Textarea value={note} onChangeText={setNote} />
          <DialogFooter>
            <Button variant="outline" onPress={() => (setRejecting(null), setNote(''))}>
              <Text>{o('cancel_action')}</Text>
            </Button>
            <Button variant="destructive" disabled={!!busy} onPress={() => rejecting && review(rejecting, 'reject', note.trim() || undefined)}>
              <Text>{o('reject')}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
