import { ActivitiesView } from '@/features/portal/activities';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Activities the student is enrolled in (web: /student/activities). */
export default function StudentActivities() {
  const data = useApi(['student', 'activities'], () => student.getStudentActivities());
  return <ActivitiesView data={data} />;
}
