import { router, Stack } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, LoadingList } from '@/components/app/states';
import { RoomCard, useLc } from '@/features/admin/jitsi';
import { jitsi } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Live rooms open to parents at the school (web: /parent/jitsi-meet, SchoolRoomsList). */
export default function ParentMeet() {
  const l = useLc();
  const res = useApi(['portal', 'jitsi-school-rooms'], () => jitsi.schoolRooms(), { refreshInterval: 15000 });
  const rooms = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: l('heading') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !rooms.length ? (
          <EmptyState title={l('no_rooms_yet')} />
        ) : (
          rooms.map((r) => <RoomCard key={r.id} room={r} onJoin={() => router.push({ pathname: '/parent/jitsi-meet/rooms/[id]', params: { id: r.id } })} />)
        )}
      </ScrollView>
    </View>
  );
}
