import { Stack } from 'expo-router';
import { Bell, Check } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { EmptyState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { isFinaKey, notificationText, useFn } from '@/features/admin/fina';
import { useCampus } from '@/features/campus/campus';
import { fina } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Fina notifications: mark one or all read (web: /admin/fina/notifications). */
export function FinaNotificationsScreen() {
  const { f, t, lang } = useFn('notifications');
  const { mutate } = useSWRConfig();
  const { campusId } = useCampus();
  const res = useApi(['admin', 'fina-notifications', campusId ?? 'school'], () => fina.notifications(campusId));
  const list = res.data ?? [];
  const unread = list.filter((n) => !n.read_at).length;
  // Also refresh the header bell count.
  const refresh = () => mutate(isFinaKey);

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: f('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}>
        {unread > 0 ? (
          <Button size="sm" variant="outline" className="self-end" onPress={async () => (await fina.markAllRead(campusId), refresh())}>
            <Text>{f('mark_all_read')}</Text>
          </Button>
        ) : null}
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={Bell} title={f('empty')} />
        ) : (
          list.map((n) => (
            <Card key={n.id} className={cn(!n.read_at && 'border-brand')}>
              <CardContent className="flex-row items-start gap-3 pt-4">
                <View className="flex-1 gap-0.5">
                  <Text className={cn('text-sm', !n.read_at && 'font-semibold')}>{notificationText(t, n)}</Text>
                  <Text className="text-muted-foreground text-xs">{new Date(n.sent_at).toLocaleString(lang)}</Text>
                </View>
                {!n.read_at ? (
                  <Pressable onPress={async () => (await fina.markRead(n.id, campusId), refresh())} hitSlop={8} className="p-1" accessibilityLabel={f('mark_all_read')}>
                    <Icon as={Check} className="text-primary size-4" />
                  </Pressable>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
