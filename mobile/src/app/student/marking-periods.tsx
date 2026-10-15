import { useCampus } from '@/features/campus/campus';
import { MarkingPeriodsView } from '@/features/portal/marking-periods';

/** Web: /student/marking-periods. */
export default function StudentMarkingPeriods() {
  const { campus, campusId } = useCampus();
  return <MarkingPeriodsView campusId={campusId ?? null} campusName={campus?.name} />;
}
