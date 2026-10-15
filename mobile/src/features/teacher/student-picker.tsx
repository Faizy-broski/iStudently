import type { Student } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Label } from '@/components/ui/label';
import { StudentChecklist } from '@/features/admin/scheduling-tools';
import { usePortalAcademic } from '@/features/portal/academic';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

import { useTeacherStudents } from './students';

/**
 * The teacher's students with check boxes, optionally narrowed to one of their course periods
 * (web: the teacher report-card / progress-report pages, "All my classes" + a class).
 */
export function TeacherStudentPicker({ cpId, onCp, selected, onChange }: { cpId: string; onCp: (id: string) => void; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.reportCards.${key}`, o);
  const academic = usePortalAcademic();
  const all = useTeacherStudents(!cpId);
  const one = useApi(cpId ? ['teacher', 'cp-students', cpId] : null, ([, , c]) => teacher.myCoursePeriodStudents(c as string));
  const cp = academic.coursePeriods.find((c) => c.id === cpId);
  const students: Student[] = cpId
    ? (one.data ?? []).map((s) => ({
        id: s.id,
        profile_id: null,
        school_id: '',
        student_number: s.student_number,
        grade_level: cp?.section?.grade_level?.name ?? null,
        section_id: s.section_id,
        profile: { first_name: s.profile?.first_name ?? '', last_name: s.profile?.last_name ?? '' } as Student['profile'],
      }))
    : (all.data ?? []);
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Label>{k('coursePeriodOptionalFilter')}</Label>
        <Picker
          value={cpId || 'all'}
          onChange={(v) => {
            onCp(v === 'all' ? '' : v);
            onChange(new Set());
          }}
          options={[{ value: 'all', label: k('allMyClasses') }, ...academic.coursePeriods.map((c) => ({ value: c.id, label: c.course?.title || c.title || k('unnamedCourse') }))]}
        />
      </View>
      <StudentChecklist students={students} loading={cpId ? one.isLoading : all.isLoading} selected={selected} onChange={onChange} countKey="common.found_students" />
    </View>
  );
}
