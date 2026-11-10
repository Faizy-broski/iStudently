// Web: /teacher/jahbadh-grades/groups (its own page; the server limits teachers to their own classes).
import { JahbadhInsightsView } from '../../admin/jahbadh/insights';

export default function TeacherJahbadhGroups() {
  return <JahbadhInsightsView view="groups" />;
}
