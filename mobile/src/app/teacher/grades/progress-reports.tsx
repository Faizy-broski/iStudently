import { useState } from 'react';

import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { ProgressReportsView } from '@/features/grades/progress-reports';
import { TeacherStudentPicker } from '@/features/teacher/student-picker';

/** The teacher's students, all classes or one (web: /teacher/grades/progress-reports; the web page only toasts, the app prints like the admin page). */
export default function TeacherProgressReports() {
  const ctx = usePrintContext();
  const { campusId } = useCampus();
  const [cpId, setCpId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return <ProgressReportsView ctx={ctx} campusId={campusId} chosen={() => [...selected]} list={<TeacherStudentPicker cpId={cpId} onCp={setCpId} selected={selected} onChange={setSelected} />} />;
}
