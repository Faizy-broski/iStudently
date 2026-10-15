import { RoomScreen } from '@/features/jitsi/room-screen';

/** Web: /parent/jitsi-meet/rooms/[roomId]. */
export default function ParentRoom() {
  return <RoomScreen basePath="/parent/jitsi-meet" />;
}
