import { NoChild, useChild } from '@/features/parent/child';
import { MarkingPeriodsView } from '@/features/portal/marking-periods';

/** Web: /parent/marking-periods (the child's campus, opens on the current quarter). */
export default function ParentMarkingPeriods() {
  const { child } = useChild();
  if (!child) return <NoChild />;
  return <MarkingPeriodsView campusId={child.campus_id ?? null} campusName={child.campus_name} selectCurrentQuarter />;
}
