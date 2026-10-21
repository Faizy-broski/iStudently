import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { CoursePanel, StudentChecklist, useCampusStudents, type PickedCoursePeriod } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminCourses, adminEmployees, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

const NA = 'na';

/** Add one course request to many students, with teacher/period preferences (web: /admin/scheduling/group-requests). */
export default function GroupRequests() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.group_requests.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const students = useCampusStudents();
  const teachers = useApi(['admin', 'tp-teachers', campusId ?? 'school'], () => adminEmployees.list('teacher', campusId, { limit: 500 }));
  const periods = useApi(['admin', 'school-periods', campusId ?? 'school'], () => adminCourses.schoolPeriods(campusId));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [course, setCourse] = useState<PickedCoursePeriod | null>(null);
  const [prefs, setPrefs] = useState({ with_teacher_id: NA, with_period_id: NA, not_teacher_id: NA, not_period_id: NA });
  const [busy, setBusy] = useState(false);

  const teacherOpts = [{ value: NA, label: t('common.na') }, ...(teachers.data ?? []).map((x) => ({ value: x.id, label: [x.profile?.first_name, x.profile?.last_name].filter(Boolean).join(' ') || g('label_teacher') }))];
  const periodOpts = [{ value: NA, label: t('common.na') }, ...(periods.data ?? []).map((p) => ({ value: p.id, label: p.title || p.period_name || p.short_name || '' }))];

  async function submit() {
    if (!selected.size) return toast.error(g('msg_select_student'));
    if (!course) return toast.error(g('msg_choose_course'));
    if (!yearId) return toast.error(g('msg_no_year'));
    setBusy(true);
    try {
      const pick = (v: string) => (v === NA ? undefined : v);
      const r = await adminScheduling.massCreateRequests({
        student_ids: [...selected],
        course_id: course.courseId,
        academic_year_id: yearId,
        campus_id: campusId,
        with_teacher_id: pick(prefs.with_teacher_id),
        not_teacher_id: pick(prefs.not_teacher_id),
        with_period_id: pick(prefs.with_period_id),
        not_period_id: pick(prefs.not_period_id),
      });
      if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
      toast.success(g('msg_request_success', { count: r.data.created }));
      if (r.data.errors.length) toast.error(g('msg_errors', { count: r.data.errors.length, errors: r.data.errors.slice(0, 3).join(', ') }));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const prefBlock = (label: string, teacherKey: 'with_teacher_id' | 'not_teacher_id', periodKey: 'with_period_id' | 'not_period_id') => (
    <View className="border-info-soft dark:border-border gap-2 rounded-xl border p-3">
      <Text className="text-sm font-semibold">{label}</Text>
      <Text className="text-muted-foreground text-xs">{g('label_teacher')}</Text>
      <Picker value={prefs[teacherKey]} onChange={(v) => setPrefs({ ...prefs, [teacherKey]: v })} options={teacherOpts} />
      <Text className="text-muted-foreground text-xs">{g('label_period')}</Text>
      <Picker value={prefs[periodKey]} onChange={(v) => setPrefs({ ...prefs, [periodKey]: v })} options={periodOpts} />
    </View>
  );
  const action = (
    <Button onPress={submit} disabled={busy}>
      <Text>{g('btn_add_request')}</Text>
    </Button>
  );

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {action}
        <Card>
          <CardContent className="gap-3 pt-4">
            <CoursePanel title={g('panel_title')} value={course} onChange={setCourse} chooseLabel={g('btn_choose_course')} changeLabel={g('btn_change_course')} />
            {prefBlock(g('label_with'), 'with_teacher_id', 'with_period_id')}
            {prefBlock(g('label_without'), 'not_teacher_id', 'not_period_id')}
          </CardContent>
        </Card>
        <StudentChecklist students={students.data ?? []} loading={students.isLoading} selected={selected} onChange={setSelected} countKey="school.scheduling.group_requests.found_students" />
        {action}
      </ScrollView>
    </View>
  );
}
