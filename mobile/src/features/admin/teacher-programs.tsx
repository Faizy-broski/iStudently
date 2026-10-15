import type { CoursePeriod } from '@studently/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { shortName } from '@/features/admin/people';
import { useSession } from '@/features/auth/session';
import { useCampus } from '@/features/campus/campus';
import { usePortalAcademicOptional } from '@/features/portal/academic';
import { adminCourses, adminEmployees, teacher } from '@/lib/api';
import { useApi } from '@/lib/data';

export type TeacherSelection = { teacherId: string; coursePeriod: CoursePeriod | null };

/** The signed-in teacher's staff id, or null for admins (who pick a teacher). */
function useSelfStaffId() {
  const { me } = useSession();
  return me.status === 'ready' && me.me.profile.role === 'teacher' ? (me.me.profile.staff_id ?? null) : null;
}

/** Selection state; in the teacher app it starts on the teacher themself (web: the teacher's own grade pages). */
export function useTeacherSelection() {
  const self = useSelfStaffId();
  return useState<TeacherSelection>(() => ({ teacherId: self ?? '', coursePeriod: null }));
}

/** Pick a teacher, then one of their course periods (web: TeacherCoursePeriodSelector). */
export function TeacherCoursePeriodPicker({ value, onChange, withCourse = true }: { value: TeacherSelection; onChange: (v: TeacherSelection) => void; withCourse?: boolean }) {
  const { t } = useTranslation();
  const p = (k: string) => t(`teacherPrograms.${k}`);
  const { campusId } = useCampus();
  const self = useSelfStaffId();
  // Teachers: no teacher picker; their own course periods of the selected year + quarter (web: getMyCoursePeriods).
  const portal = usePortalAcademicOptional();
  const yearId = portal?.year?.id ?? null;
  const quarterId = portal?.quarter?.id ?? null;
  const own = useApi(self && yearId ? ['teacher', 'my-cps-quarter', yearId, quarterId ?? ''] : null, ([, , y, q]) => teacher.myCoursePeriods(y as string, (q as string) || undefined));
  const teachers = useApi(self ? null : ['admin', 'tp-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { limit: 500 }));
  const cps = useApi(!self && value.teacherId ? ['admin', 'all-course-periods', campusId ?? 'school'] : null, () => adminCourses.allCoursePeriods(campusId));
  const mine = self ? (own.data ?? []) : (cps.data ?? []).filter((cp) => cp.teacher_id === value.teacherId || cp.secondary_teacher_id === value.teacherId);
  const cpLoading = self ? own.isLoading : cps.isLoading;

  return (
    <View className="gap-3">
      {self ? null : (
        <View className="gap-1.5">
          <Label>{p('selectorTeacherLabel')}</Label>
          {teachers.isLoading ? (
            <Text className="text-muted-foreground text-sm">{p('selectorLoadingTeachers')}</Text>
          ) : (
            <Picker
              value={value.teacherId}
              onChange={(id) => onChange({ teacherId: id, coursePeriod: null })}
              placeholder={p('selectorTeacherPlaceholder')}
              options={[{ value: '', label: p('selectorTeacherPlaceholder') }, ...(teachers.data ?? []).map((s) => ({ value: s.id, label: shortName(s.profile) || s.id }))]}
            />
          )}
        </View>
      )}
      {withCourse ? (
        <View className="gap-1.5">
          <Label>{p('selectorCourseLabel')}</Label>
          {cpLoading ? (
            <Text className="text-muted-foreground text-sm">{p('selectorLoadingCourses')}</Text>
          ) : value.teacherId && !mine.length ? (
            <Text className="text-muted-foreground text-sm">{p('selectorNoCoursePeriods')}</Text>
          ) : (
            <Picker
              value={value.coursePeriod?.id ?? ''}
              onChange={(id) => onChange({ teacherId: value.teacherId, coursePeriod: mine.find((c) => c.id === id) ?? null })}
              placeholder={p('selectorCoursePlaceholder')}
              options={[{ value: '', label: p('selectorCoursePlaceholder') }, ...mine.map((cp) => ({ value: cp.id, label: `${cp.course?.title || cp.id}${cp.period?.period_name ? ` (${cp.period.period_name})` : ''}` }))]}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}
