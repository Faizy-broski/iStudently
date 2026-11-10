// Web: /teacher/jahbadh-grades/early-warning (its own page; the server limits teachers to their own classes).
import { JahbadhInsightsView } from '../../admin/jahbadh/insights';

export default function TeacherJahbadhEarlyWarning() {
  return <JahbadhInsightsView view="warning" />;
}
