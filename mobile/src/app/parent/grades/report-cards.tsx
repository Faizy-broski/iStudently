import { useTranslation } from 'react-i18next';

import { ReportCardsView } from '@/features/grades/report-cards';
import { NoChild, useChild } from '@/features/parent/child';
import { OneStudentCard } from '@/features/parent/one-student';
import { usePortalPrintContext } from '@/features/portal/print-context';

/** The selected child's report cards (web: /parent/grades/report-cards). */
export default function ParentReportCards() {
  const { t } = useTranslation();
  const { child } = useChild();
  const ctx = usePortalPrintContext(child?.campus_id);
  if (!child) return <NoChild />;
  return (
    <ReportCardsView
      ctx={ctx}
      campusId={child.campus_id}
      chosen={() => [child.id]}
      list={<OneStudentCard child={child} />}
      subtitle={t('app.pa_rc_subtitle', { name: `${child.first_name} ${child.last_name}`, campus: child.campus_name })}
    />
  );
}
