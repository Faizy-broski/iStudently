import { EventDetailsScreen } from '@/features/events/event-details';

/** Web: EventDetailsDialog without edit / delete. */
export default function ParentEventDetails() {
  return <EventDetailsScreen canEdit={false} />;
}
