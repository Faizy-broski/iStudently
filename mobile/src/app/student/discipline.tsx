import { DisciplineView } from '@/features/portal/discipline';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The student's discipline referrals with their field values (web: /student/discipline). */
export default function StudentDiscipline() {
  const data = useApi(['student', 'discipline'], () => student.getStudentDiscipline());
  return <DisciplineView data={data} />;
}
