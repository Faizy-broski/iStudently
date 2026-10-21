import { router, Stack } from 'expo-router';
import { Video } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, LoadingList } from '@/components/app/states';
import { RoomCard, useLc } from '@/features/admin/jitsi';
import { jitsi } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Live rooms opened by the school's teachers and admins (web: /student/jitsi-meet, SchoolRoomsList). */
export default function StudentMeet() {
  const l = useLc();
  const res = useApi(['portal', 'jitsi-school-rooms'], () => jitsi.schoolRooms(), { refreshInterval: 15000 });
  const rooms = res.data ?? [];
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: l('heading') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : !rooms.length ? (
          <EmptyState icon={Video} title={l('no_rooms_yet')} />
        ) : (
          rooms.map((r) => <RoomCard key={r.id} room={r} onJoin={() => router.push({ pathname: '/student/jitsi-meet/rooms/[id]', params: { id: r.id } })} />)
        )}
      </ScrollView>
    </View>
  );
}
