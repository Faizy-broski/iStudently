import { useTranslation } from 'react-i18next';

import { LessonPlanRead } from '@/features/portal/lesson-plan-read';
import { student } from '@/lib/api';

/** Published lesson plans of the student's course periods (web: /student/scheduling/lesson-plan-read). */
export default function StudentLessonPlanRead() {
  const { t } = useTranslation();
  return <LessonPlanRead scope="self" load={(cp) => student.getStudentLessonPlans(cp)} subtitle={t('app.st_lp_subtitle')} />;
}
