import { router, Stack } from 'expo-router';
import { CalendarClock, ListChecks, Video } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ActionRow, Panel } from '@/components/app/panel';
import { IconTile } from '@/components/app/layout';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { adminOnlineClasses } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Open online courses with seats left; enroll (web: /student/online-classes). */
export default function StudentBrowseOnlineClasses() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`online_classes.${key}`, o);
  const toast = useToast();
  const list = useApi(['student', 'online-open'], () => adminOnlineClasses.openClasses());
  const [busy, setBusy] = useState<string | null>(null);

  async function enroll(id: string) {
    setBusy(id);
    const r = await adminOnlineClasses.enroll(id);
    setBusy(null);
    if (!r.success) return toast.error(r.error || k('network_error'));
    toast.success(k('msg_enrolled'));
    list.mutate();
  }

  return (
    <>
      <Stack.Screen options={{ title: k('browse_open_courses') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('student_subtitle')}</Text>
        <Panel>
          <ActionRow icon={ListChecks} title={k('my_enrolled_classes')} onPress={() => router.push('/student/online-classes/enrolled')} last />
        </Panel>
        {list.isLoading ? (
          <LoadingList rows={4} />
        ) : list.error ? (
          <ErrorState message={list.error.message || k('network_error')} onRetry={() => list.mutate()} />
        ) : !(list.data ?? []).length ? (
          <EmptyState icon={Video} title={k('no_open_courses')} />
        ) : (
          (list.data ?? []).map((c) => {
            const full = c.seats_remaining <= 0;
            return (
              <Panel key={c.id} className="gap-3 p-4">
                <View className="flex-row items-start gap-3">
                  <IconTile icon={Video} tone={full ? 'muted' : 'brand'} size={40} />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-semibold">{c.title}</Text>
                    {c.description ? <Text className="text-muted-foreground text-xs">{c.description}</Text> : null}
                  </View>
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  {c.scheduled_days ? (
                    <View className="flex-row items-center gap-1.5">
                      <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                      <Text className="text-muted-foreground text-xs">{c.scheduled_days}</Text>
                    </View>
                  ) : null}
                  <StatusChip label={k('seats_remaining', { count: c.seats_remaining })} tone={full ? 'destructive' : 'success'} />
                </View>
                <Button size="sm" disabled={full || busy === c.id} onPress={() => enroll(c.id)}>
                  <Text>{full ? k('full') : k('enroll')}</Text>
                </Button>
              </Panel>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
