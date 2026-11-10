// Web: /teacher/jahbadh-grades/student-profile (its own page; the server limits teachers to their own classes).
import { JahbadhInsightsView } from '../../admin/jahbadh/insights';

export default function TeacherJahbadhStudentProfile() {
  return <JahbadhInsightsView view="profile" />;
}
