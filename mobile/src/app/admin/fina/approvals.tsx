import { ModerationQueueScreen } from '@/features/fina/moderation-queue';

/** Principal approval queue (web: /admin/fina/approvals). */
export default function FinaApprovals() {
  return <ModerationQueueScreen mode="approval" />;
}
