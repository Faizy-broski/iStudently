import { useState } from 'react';

import { useAcademicYears } from '@/features/admin/grades';
import { usePrintContext } from '@/features/admin/print-context';
import { StudentChecklist, studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { PrintSchedulesView } from '@/features/scheduling/print-schedules';

/** Printable weekly schedules for the chosen students, as a grid or a list (web: /admin/scheduling/print-schedules). */
export default function PrintSchedules() {
  const ctx = usePrintContext();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  // Teachers print for their selected year (web: AcademicContext), admins the current one.
  const portal = usePortalAcademicOptional();
  const students = useCampusStudents();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const chosen = () =>
    (students.data ?? []).filter((s) => selected.has(s.id)).map((s) => ({ id: s.id, name: studentFullName(s.profile), number: s.student_number, grade: s.grade_level ?? null }));
  return (
    <PrintSchedulesView
      ctx={ctx}
      campusId={campusId}
      yearId={portal ? (portal.year?.id ?? null) : (years.current?.id ?? null)}
      chosen={chosen}
      list={<StudentChecklist students={students.data ?? []} loading={students.isLoading} selected={selected} onChange={setSelected} countKey="common.found_students" />}
    />
  );
}
