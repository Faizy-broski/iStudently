import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { ActivitiesView } from '@/features/portal/activities';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Activities the selected child is enrolled in (web: /parent/activities). */
export default function ParentActivities() {
  const { t } = useTranslation();
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'activities', childId] : null, ([, , id]) => parent.getStudentEnrolledActivities(id as string));
  if (!childId) return <NoChild />;
  return <ActivitiesView data={data} text={{ title: t('app.pa_ac_title'), subtitle: t('app.pa_ac_subtitle'), emptyBody: t('app.pa_ac_empty_body') }} />;
}
