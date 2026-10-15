import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useAcademicYears } from '@/features/admin/grades';
import { CoursePanel, StudentChecklist, useCampusStudents, type PickedCoursePeriod } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminGrades, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Enroll many students in one course period (web: /admin/scheduling/group-schedule). */
export default function GroupSchedule() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.group_schedule.${k}`, o);
  const toast = useToast();
  const { campusId } = useCampus();
  const years = useAcademicYears();
  const yearId = years.current?.id ?? null;
  const students = useCampusStudents();
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cp, setCp] = useState<PickedCoursePeriod | null>(null);
  const [mp, setMp] = useState('full-year');
  const [start, setStart] = useState(todayYmd());
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!selected.size) return toast.error(g('msg_select_student'));
    if (!cp) return toast.error(g('msg_choose_course'));
    if (!yearId) return toast.error(g('msg_no_year'));
    setBusy(true);
    try {
      const r = await adminScheduling.massEnroll({
        student_ids: [...selected],
        course_period_id: cp.coursePeriodId,
        course_id: cp.courseId,
        academic_year_id: yearId,
        marking_period_id: mp !== 'full-year' ? mp : undefined,
        start_date: start,
        campus_id: campusId,
      });
      if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
      toast.success(g('msg_enrolled_success', { count: r.data.enrolled }));
      if (r.data.errors.length) toast.error(g('msg_errors', { count: r.data.errors.length, errors: r.data.errors.slice(0, 3).join(', ') }));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const action = (
    <Button onPress={add} disabled={busy}>
      <Text>{g('btn_add_courses')}</Text>
    </Button>
  );
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {action}
        <Card>
          <CardContent className="gap-4 pt-4">
            <CoursePanel title={g('panel_title')} value={cp} onChange={setCp} chooseLabel={g('btn_choose_course')} changeLabel={g('btn_change_course')} />
            <DateField label={g('label_start_date')} value={start} onChange={setStart} />
            <View className="gap-1.5">
              <Label>{g('label_marking_period')}</Label>
              <Picker value={mp} onChange={setMp} options={[{ value: 'full-year', label: g('term_full_year') }, ...(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))]} />
            </View>
          </CardContent>
        </Card>
        <StudentChecklist students={students.data ?? []} loading={students.isLoading} selected={selected} onChange={setSelected} countKey="school.scheduling.group_schedule.found_students" />
        {action}
      </ScrollView>
    </View>
  );
}
