import { ModerationQueueScreen } from '@/features/fina/moderation-queue';

/** Review queue (web: /media-officer/fina/review). */
export default function MediaOfficerReview() {
  return <ModerationQueueScreen mode="review" notificationsHref="/media-officer/notifications" />;
}
