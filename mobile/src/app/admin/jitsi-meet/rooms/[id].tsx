import { RoomScreen } from '@/features/jitsi/room-screen';

/** Web: /admin/jitsi-meet/rooms/[id]. */
export default function AdminRoom() {
  return <RoomScreen basePath="/admin/jitsi-meet" />;
}
