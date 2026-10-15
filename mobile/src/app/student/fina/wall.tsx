import { FinaWallScreen } from '@/features/fina/wall';

/** Web: /student/fina/wall. */
export default function StudentFinaWall() {
  return <FinaWallScreen canCompose={false} notificationsHref="/student/fina/notifications" />;
}
