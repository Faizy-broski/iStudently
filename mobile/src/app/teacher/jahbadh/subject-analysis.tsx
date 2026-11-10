// Web: /teacher/jahbadh-grades/subject-analysis (its own page; the server limits teachers to their own classes).
import { JahbadhInsightsView } from '../../admin/jahbadh/insights';

export default function TeacherJahbadhSubjectAnalysis() {
  return <JahbadhInsightsView view="analysis" />;
}
