import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { LessonPlanRead } from '@/features/portal/lesson-plan-read';
import { parent } from '@/lib/api';

/** Published lesson plans of the selected child's course periods (web: /parent/scheduling/lesson-plan-read). */
export default function ParentLessonPlanRead() {
  const { t } = useTranslation();
  const { childId } = useChild();
  if (!childId) return <NoChild />;
  return <LessonPlanRead key={childId} scope={childId} load={(cp) => parent.getStudentLessonPlans(childId, cp)} subtitle={t('app.pa_lp_subtitle')} />;
}
