import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePrintContext } from '@/features/admin/print-context';
import { ReportStudents } from '@/features/admin/report-students';
import { useCampus } from '@/features/campus/campus';
import { ProgressReportsView } from '@/features/grades/progress-reports';

/** Gradebook progress reports for chosen students (web: /admin/grades/progress-reports). */
export default function ProgressReports() {
  const { t } = useTranslation();
  const ctx = usePrintContext();
  const { campusId } = useCampus();
  const [grade, setGrade] = useState('all');
  const [students, setStudents] = useState<Set<string>>(new Set());
  return (
    <ProgressReportsView
      ctx={ctx}
      campusId={campusId}
      chosen={() => [...students]}
      list={<ReportStudents grade={grade} onGrade={setGrade} selected={students} onChange={setStudents} allLabel={t('school.grades_module.common.all_grades')} />}
    />
  );
}
