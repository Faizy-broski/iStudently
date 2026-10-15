import { RoomScreen } from '@/features/jitsi/room-screen';

/** Web: /student/jitsi-meet/rooms/[roomId]. */
export default function StudentRoom() {
  return <RoomScreen basePath="/student/jitsi-meet" />;
}
