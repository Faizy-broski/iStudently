import type { DisciplineReferral } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField, todayYmd } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { ALL, useAttendanceScope } from '@/features/admin/attendance';
import { CountsBreakdown } from '@/features/admin/report-views';
import { adminAcademics, adminDiscipline } from '@/lib/api';
import { useApi } from '@/lib/data';

const STUDENT_FIELDS = [{ value: 'grade_level', label: 'gradeLevel' }];

/** Referral counts by a student field such as grade level (web: /admin/discipline/reports/breakdown-student-field). */
export default function DisciplineByStudentField() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`discipline.${k}`, o);
  const toast = useToast();
  const { schoolId, campusId } = useAttendanceScope();
  const [studentField, setStudentField] = useState('grade_level');
  const [grade, setGrade] = useState(ALL);
  const [sectionId, setSectionId] = useState(ALL);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(todayYmd);
  const [loading, setLoading] = useState(false);
  const [referrals, setReferrals] = useState<DisciplineReferral[] | null>(null);
  const grades = useApi(campusId ? ['admin', 'grades', campusId] : null, () => adminAcademics.grades(campusId));
  const gradeObj = (grades.data ?? []).find((g) => g.name === grade);
  const sections = useApi(gradeObj && campusId ? ['admin', 'sections', campusId, gradeObj.id] : null, ([, , , g]) => adminAcademics.sections(campusId, g as string));

  async function go() {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await adminDiscipline.getReportReferrals({
        school_id: schoolId,
        campus_id: campusId,
        start_date: start || undefined,
        end_date: end || undefined,
        grade_level: grade !== ALL ? grade : undefined,
        section_id: sectionId !== ALL ? sectionId : undefined,
      });
      if (!res.success) return toast.error(res.error || d('errors.loadReferrals'));
      setReferrals(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  const counts: Record<string, number> = {};
  for (const r of referrals ?? []) {
    const key = (studentField === 'grade_level' ? r.students?.grade_level : null)?.trim() || d('notSpecified');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const data = Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));
  const total = data.reduce((s, x) => s + x.value, 0);
  const fieldLabel = d(STUDENT_FIELDS.find((f) => f.value === studentField)?.label ?? studentField);

  return (
    <>
      <Stack.Screen options={{ title: d('breakdownByStudentField') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Card>
          <CardContent className="gap-3 pt-4">
            <View className="gap-1.5">
              <Label>{d('studentField')}</Label>
              <Picker value={studentField} onChange={setStudentField} placeholder={d('chooseStudentField')} options={STUDENT_FIELDS.map((f) => ({ value: f.value, label: d(f.label) }))} />
            </View>
            <View className="flex-row gap-2">
              <View className="flex-1 gap-1.5">
                <Label>{d('gradeLevel')}</Label>
                <Picker
                  value={grade}
                  onChange={(g) => {
                    setGrade(g);
                    setSectionId(ALL);
                  }}
                  options={[{ value: ALL, label: d('allGrades') }, ...(grades.data ?? []).map((g) => ({ value: g.name, label: g.name }))]}
                />
              </View>
              <View className="flex-1 gap-1.5">
                <Label>{d('section')}</Label>
                <Picker value={sectionId} onChange={setSectionId} options={[{ value: ALL, label: d('allSections') }, ...(sections.data ?? []).map((s) => ({ value: s.id, label: s.name }))]} />
              </View>
            </View>
            <View className="flex-row gap-2">
              <DateField className="flex-1" label={d('reportTimeframeFrom')} value={start} onChange={setStart} clearable />
              <DateField className="flex-1" label={d('to')} value={end} onChange={setEnd} clearable />
            </View>
            <Button onPress={go} disabled={loading}>
              <Text>{d('go')}</Text>
            </Button>
          </CardContent>
        </Card>
        {referrals ? (
          <Card>
            <CardHeader>
              <CardTitle>{`${fieldLabel} · ${d('referralsCount', { count: total })}`}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length === 0 ? (
                <EmptyState title={d('noReferralsForFilters')} />
              ) : (
                <CountsBreakdown data={data} nameHeader={fieldLabel} valueHeader={d('numberOfReferrals')} labels={{ column: d('column'), pie: d('pie'), list: d('list'), total: d('total') }} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
