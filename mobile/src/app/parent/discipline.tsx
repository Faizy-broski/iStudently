import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { DisciplineView } from '@/features/portal/discipline';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The selected child's discipline referrals (web: /parent/discipline). */
export default function ParentDiscipline() {
  const { t } = useTranslation();
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'discipline', childId] : null, ([, , id]) => parent.getStudentDiscipline(id as string));
  if (!childId) return <NoChild />;
  return <DisciplineView data={data} text={{ subtitle: t('app.pa_dc_subtitle'), cleanBody: t('app.pa_dc_clean_body') }} />;
}
