import { RoomScreen } from '@/features/jitsi/room-screen';

/** Web: /teacher/jitsi-meet/rooms/[roomId]. */
export default function TeacherRoom() {
  return <RoomScreen basePath="/teacher/jitsi-meet" />;
}
