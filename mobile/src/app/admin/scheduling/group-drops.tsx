import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useConfirm } from '@/components/app/confirm';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { CoursePanel, StudentChecklist, useCampusStudents, type PickedCoursePeriod } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminGrades, adminScheduling } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Drop many students from one course period as of a date (web: /admin/scheduling/group-drops). */
export default function GroupDrops() {
  const { t } = useTranslation();
  const g = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.group_drops.${k}`, o);
  const toast = useToast();
  const confirm = useConfirm();
  const { campusId } = useCampus();
  const students = useCampusStudents();
  const mps = useApi(['admin', 'marking-periods', campusId ?? 'school'], () => adminGrades.markingPeriods(campusId));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cp, setCp] = useState<PickedCoursePeriod | null>(null);
  const [mp, setMp] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [busy, setBusy] = useState(false);

  async function drop() {
    if (!selected.size) return toast.error(g('msg_select_student'));
    if (!cp) return toast.error(g('msg_choose_drop'));
    if (!(await confirm({ title: g('btn_drop_course'), body: `${cp.courseTitle} · ${cp.periodLabel}`, destructive: true, confirmLabel: g('btn_drop_course') }))) return;
    setBusy(true);
    try {
      const r = await adminScheduling.massDrop({ student_ids: [...selected], course_period_id: cp.coursePeriodId, end_date: date });
      if (!r.success || !r.data) return toast.error(r.error || t('common.error'));
      toast.success(g('msg_drop_success', { count: r.data.dropped }));
      if (r.data.errors.length) toast.error(g('msg_errors', { count: r.data.errors.length, errors: r.data.errors.slice(0, 3).join(', ') }));
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  }

  const action = (
    <Button variant="destructive" onPress={drop} disabled={busy}>
      <Text>{g('btn_drop_course')}</Text>
    </Button>
  );
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-4 p-4 pb-10" keyboardShouldPersistTaps="handled">
        {action}
        <Card>
          <CardContent className="gap-4 pt-4">
            <CoursePanel title={g('panel_title')} value={cp} onChange={setCp} chooseLabel={g('btn_choose_course')} changeLabel={g('btn_choose_course')} />
            <DateField label={g('label_drop_date')} value={date} onChange={setDate} />
            <View className="gap-1.5">
              <Label>{g('label_marking_period')}</Label>
              <Picker value={mp} onChange={setMp} placeholder={g('placeholder_select_mp')} options={(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))} />
            </View>
          </CardContent>
        </Card>
        <StudentChecklist students={students.data ?? []} loading={students.isLoading} selected={selected} onChange={setSelected} countKey="school.scheduling.group_drops.found_students" />
        {action}
      </ScrollView>
    </View>
  );
}
