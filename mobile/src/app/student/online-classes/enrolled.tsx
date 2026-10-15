import { router, Stack } from 'expo-router';
import { AlertTriangle, CalendarClock, RefreshCw, Video, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <Text variant="muted">{k('enrolled_subtitle')}</Text>
        {list.isLoading ? (
          <LoadingList rows={4} />
        ) : list.error ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={AlertTriangle} className="text-destructive mb-3 size-10" />
              <Text className="text-destructive font-medium">{k('network_error')}</Text>
              <Button variant="outline" size="sm" className="mt-4" onPress={() => list.mutate()}>
                <Icon as={RefreshCw} className="size-3.5" />
                <Text>{k('retry')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : !(list.data ?? []).length ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={Video} className="text-muted-foreground mb-3 size-10" />
              <Text className="text-muted-foreground">{k('no_enrollments_yet')}</Text>
            </CardContent>
          </Card>
        ) : (
          (list.data ?? []).map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                {c.description ? <CardDescription>{c.description}</CardDescription> : null}
              </CardHeader>
              <CardContent className="gap-3">
                {c.scheduled_days ? (
                  <View className="flex-row items-center gap-1">
                    <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                    <Text className="text-muted-foreground text-sm">{`${c.scheduled_days} ${c.session_start_time || ''}${c.session_end_time ? `–${c.session_end_time}` : ''}`}</Text>
                  </View>
                ) : null}
                <View className="flex-row gap-2">
                  {c.status === 'active' && c.jitsi_room_id ? (
                    <Button size="sm" onPress={() => router.push({ pathname: '/student/jitsi-meet/rooms/[id]', params: { id: c.jitsi_room_id as string } })}>
                      <Icon as={Video} className="text-primary-foreground size-4" />
                      <Text>{k('join_class')}</Text>
                    </Button>
                  ) : null}
                  {c.class_type === 'external_open' ? (
                    <Button size="sm" variant="ghost" disabled={busy === c.id} onPress={() => withdraw(c.id)}>
                      <Icon as={XCircle} className="text-destructive size-4" />
                      <Text className="text-destructive">{k('withdraw')}</Text>
                    </Button>
                  ) : null}
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}
