import { router, Stack } from 'expo-router';
import { CalendarClock, Video, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminOnlineClasses } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Classes the student is enrolled in; join a running session, withdraw from open courses (web: /student/online-classes/enrolled). */
export default function StudentEnrolledClasses() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`online_classes.${key}`, o);
  const toast = useToast();
  // Polled so the Join button appears when the teacher starts the session.
  const list = useApi(['student', 'online-enrolled'], () => adminOnlineClasses.enrolled(), { refreshInterval: 15000 });
  const [busy, setBusy] = useState<string | null>(null);

  async function withdraw(id: string) {
    setBusy(id);
    const r = await adminOnlineClasses.withdraw(id);
    setBusy(null);
    if (!r.success) return toast.error(r.error || k('network_error'));
    toast.success(k('msg_withdrawn'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('my_enrolled_classes') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('enrolled_subtitle')}</Text>
        {list.isLoading ? (
          <LoadingList rows={4} />
        ) : list.error ? (
          <ErrorState message={k('network_error')} onRetry={() => list.mutate()} />
        ) : !(list.data ?? []).length ? (
          <EmptyState icon={Video} title={k('no_enrollments_yet')} />
        ) : (
          (list.data ?? []).map((c) => {
            const live = c.status === 'active' && !!c.jitsi_room_id;
            return (
              <Panel key={c.id} className="gap-3 p-4">
                <View className="flex-row items-start gap-3">
                  <IconTile icon={Video} tone={live ? 'success' : 'brand'} size={40} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{c.title}</Text>
                    {c.description ? <Text className="text-muted-foreground text-xs">{c.description}</Text> : null}
                  </View>
                  {live ? <StatusChip label={k('join_class')} tone="success" /> : null}
                </View>
                {c.scheduled_days ? (
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                    <Text className="text-muted-foreground text-xs">{`${c.scheduled_days} ${c.session_start_time || ''}${c.session_end_time ? `–${c.session_end_time}` : ''}`}</Text>
                  </View>
                ) : null}
                {live || c.class_type === 'external_open' ? (
                  <View className="flex-row gap-2">
                    {live ? (
                      <Button size="sm" onPress={() => router.push({ pathname: '/student/jitsi-meet/rooms/[id]', params: { id: c.jitsi_room_id as string } })}>
                        <Icon as={Video} className="text-primary-foreground size-4" />
                        <Text>{k('join_class')}</Text>
                      </Button>
                    ) : null}
                    {c.class_type === 'external_open' ? (
                      <Button size="sm" variant="ghost" className="bg-destructive-soft" disabled={busy === c.id} onPress={() => withdraw(c.id)}>
                        <Icon as={XCircle} className="text-destructive size-4" />
                        <Text className="text-destructive">{k('withdraw')}</Text>
                      </Button>
                    ) : null}
                  </View>
                ) : null}
              </Panel>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
