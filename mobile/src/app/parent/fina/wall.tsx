import { FinaWallScreen } from '@/features/fina/wall';

/** Web: /parent/fina/wall. */
export default function ParentFinaWall() {
  return <FinaWallScreen canCompose={false} notificationsHref="/parent/fina/notifications" />;
}
