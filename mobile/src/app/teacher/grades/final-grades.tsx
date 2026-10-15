import { useState } from 'react';

import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { FinalGradeListsView } from '@/features/grades/final-grade-lists';
import { TeacherStudentPicker } from '@/features/teacher/student-picker';

/** Final grade lists for the teacher's students and chosen quarters (web: /teacher/grades/final-grades, StudentGradesDashboard). */
export default function TeacherFinalGradeLists() {
  const ctx = usePrintContext();
  const { campusId } = useCampus();
  const [cpId, setCpId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return <FinalGradeListsView ctx={ctx} campusId={campusId} chosen={() => [...selected]} quartersOnly list={<TeacherStudentPicker cpId={cpId} onCp={setCpId} selected={selected} onChange={setSelected} />} />;
}
