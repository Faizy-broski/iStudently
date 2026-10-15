import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePrintContext } from '@/features/admin/print-context';
import { ReportStudents } from '@/features/admin/report-students';
import { useCampus } from '@/features/campus/campus';
import { FinalGradeListsView } from '@/features/grades/final-grade-lists';

/** Final grade lists for chosen students and marking periods (web: /admin/grades/final-grades). */
export default function FinalGradeLists() {
  const { t } = useTranslation();
  const ctx = usePrintContext();
  const { campusId } = useCampus();
  const [grade, setGrade] = useState('all');
  const [students, setStudents] = useState<Set<string>>(new Set());
  return (
    <FinalGradeListsView
      ctx={ctx}
      campusId={campusId}
      chosen={() => [...students]}
      list={<ReportStudents grade={grade} onGrade={setGrade} selected={students} onChange={setStudents} allLabel={t('school.grades_module.final_grades.all_grade_levels')} />}
    />
  );
}
