import { useTranslation } from 'react-i18next';

import { TranscriptsView } from '@/features/grades/transcripts';
import { NoChild, useChild } from '@/features/parent/child';
import { OneStudentCard } from '@/features/parent/one-student';
import { usePortalPrintContext } from '@/features/portal/print-context';

/** The selected child's transcripts (web: /parent/grades/transcripts). */
export default function ParentTranscripts() {
  const { t } = useTranslation();
  const { child } = useChild();
  const ctx = usePortalPrintContext(child?.campus_id);
  if (!child) return <NoChild />;
  return (
    <TranscriptsView
      ctx={ctx}
      campusId={child.campus_id}
      chosen={() => [child.id]}
      list={<OneStudentCard child={child} />}
      subtitle={t('app.pa_tr_subtitle', { name: `${child.first_name} ${child.last_name}`, campus: child.campus_name })}
    />
  );
}
