import { router, Stack } from 'expo-router';
import { AlertTriangle, CalendarClock, ListChecks, RefreshCw, Users, Video } from 'lucide-react-native';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => list.mutate()} />}>
        <Text variant="muted">{k('student_subtitle')}</Text>
        <Button variant="outline" className="self-start" onPress={() => router.push('/student/online-classes/enrolled')}>
          <Icon as={ListChecks} className="size-4" />
          <Text>{k('my_enrolled_classes')}</Text>
        </Button>
        {list.isLoading ? (
          <LoadingList rows={4} />
        ) : list.error ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={AlertTriangle} className="text-destructive mb-3 size-10" />
              <Text className="text-destructive font-medium">{list.error.message || k('network_error')}</Text>
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
              <Text className="text-muted-foreground">{k('no_open_courses')}</Text>
            </CardContent>
          </Card>
        ) : (
          (list.data ?? []).map((c) => {
            const full = c.seats_remaining <= 0;
            return (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="text-base">{c.title}</CardTitle>
                  {c.description ? <CardDescription>{c.description}</CardDescription> : null}
                </CardHeader>
                <CardContent className="gap-3">
                  <View className="flex-row flex-wrap items-center gap-3">
                    {c.scheduled_days ? (
                      <View className="flex-row items-center gap-1">
                        <Icon as={CalendarClock} className="text-muted-foreground size-3.5" />
                        <Text className="text-muted-foreground text-sm">{c.scheduled_days}</Text>
                      </View>
                    ) : null}
                    <View className="flex-row items-center gap-1">
                      <Icon as={Users} className="text-muted-foreground size-3.5" />
                      <Text className="text-muted-foreground text-sm">{k('seats_remaining', { count: c.seats_remaining })}</Text>
                    </View>
                  </View>
                  <Button size="sm" disabled={full || busy === c.id} onPress={() => enroll(c.id)}>
                    <Text>{full ? k('full') : k('enroll')}</Text>
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </ScrollView>
    </>
  );
}
