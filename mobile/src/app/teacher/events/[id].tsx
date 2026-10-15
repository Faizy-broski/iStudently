import { EventDetailsScreen } from '@/features/events/event-details';

/** Read-only event details. */
export default function TeacherEventDetails() {
  return <EventDetailsScreen canEdit={false} />;
}
