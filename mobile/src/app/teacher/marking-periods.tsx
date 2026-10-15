import { useCampus } from '@/features/campus/campus';
import { MarkingPeriodsView } from '@/features/portal/marking-periods';

/** Web: /teacher/marking-periods. */
export default function TeacherMarkingPeriods() {
  const { campus, campusId } = useCampus();
  return <MarkingPeriodsView campusId={campusId ?? null} campusName={campus?.name} />;
}
