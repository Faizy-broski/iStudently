import { useState } from 'react';

import { usePrintContext } from '@/features/admin/print-context';
import { useCampus } from '@/features/campus/campus';
import { ReportCardsView } from '@/features/grades/report-cards';
import { TeacherStudentPicker } from '@/features/teacher/student-picker';

/** The teacher's students, all classes or one (web: /teacher/grades/report-cards; the web page only toasts, the app prints like the admin page). */
export default function TeacherReportCards() {
  const ctx = usePrintContext();
  const { campusId } = useCampus();
  const [cpId, setCpId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return <ReportCardsView ctx={ctx} campusId={campusId} chosen={() => [...selected]} list={<TeacherStudentPicker cpId={cpId} onCp={setCpId} selected={selected} onChange={setSelected} />} />;
}
