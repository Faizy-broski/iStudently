import { router, Stack } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { RoomCard, useLc } from '@/features/admin/jitsi';
import { jitsi } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useRoleBase } from '@/features/portal/role-base';

/** Live class rooms to join (web: /admin/jitsi-meet, MeetList). */
export default function MeetList() {
  const role = useRoleBase();
  const l = useLc();
  const res = useApi(['admin', 'jitsi-my-rooms'], () => jitsi.myRooms());
  const rooms = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: l('heading') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !rooms.length ? (
          <Text className="text-muted-foreground py-8 text-center text-sm">{l('no_rooms_yet')}</Text>
        ) : (
          rooms.map((r) => <RoomCard key={r.id} room={r} onJoin={() => router.push(role.href('/jitsi-meet/rooms/[id]', { id: r.id }))} />)
        )}
      </ScrollView>
    </View>
  );
}
