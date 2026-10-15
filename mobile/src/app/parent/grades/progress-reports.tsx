import { useTranslation } from 'react-i18next';

import { ProgressReportsView } from '@/features/grades/progress-reports';
import { NoChild, useChild } from '@/features/parent/child';
import { OneStudentCard } from '@/features/parent/one-student';
import { usePortalPrintContext } from '@/features/portal/print-context';

/** The selected child's progress reports (web: /parent/grades/progress-reports). */
export default function ParentProgressReports() {
  const { t } = useTranslation();
  const { child } = useChild();
  const ctx = usePortalPrintContext(child?.campus_id);
  if (!child) return <NoChild />;
  return (
    <ProgressReportsView
      ctx={ctx}
      campusId={child.campus_id}
      chosen={() => [child.id]}
      list={<OneStudentCard child={child} />}
      subtitle={t('app.pa_pr_subtitle', { name: `${child.first_name} ${child.last_name}`, campus: child.campus_name })}
    />
  );
}
