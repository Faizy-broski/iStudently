import { FinaWallScreen } from '@/features/fina/wall';

/** Web: /teacher/fina/wall. */
export default function TeacherFinaWall() {
  return <FinaWallScreen canCompose notificationsHref="/teacher/fina/notifications" />;
}
