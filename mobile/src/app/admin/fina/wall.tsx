import { FinaWallScreen } from '@/features/fina/wall';

/** Web: /admin/fina/wall. */
export default function AdminFinaWall() {
  return <FinaWallScreen canCompose notificationsHref="/admin/fina/notifications" />;
}
