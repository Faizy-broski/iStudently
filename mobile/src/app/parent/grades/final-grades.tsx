import { useTranslation } from 'react-i18next';

import { NoChild, useChild } from '@/features/parent/child';
import { OneStudentCard } from '@/features/parent/one-student';
import { FinalGradeListsView } from '@/features/grades/final-grade-lists';
import { usePortalPrintContext } from '@/features/portal/print-context';

/** The selected child's final grade list for chosen quarters (web: /parent/grades/final-grades). */
export default function ParentFinalGrades() {
  const { t } = useTranslation();
  const { child } = useChild();
  const ctx = usePortalPrintContext(child?.campus_id);
  if (!child) return <NoChild />;
  return (
    <FinalGradeListsView
      ctx={ctx}
      campusId={child.campus_id}
      chosen={() => [child.id]}
      list={<OneStudentCard child={child} />}
      subtitle={t('app.pa_fg_subtitle', { name: `${child.first_name} ${child.last_name}`, campus: child.campus_name })}
      quartersOnly
    />
  );
}
