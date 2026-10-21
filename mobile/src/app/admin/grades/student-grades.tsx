import type { StudentFinalGrade } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { fmtGpa, fmtPercent, useMarkingPeriods } from '@/features/admin/grades';
import { StudentSearchSelect, type PickedStudent } from '@/features/admin/student-search';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const ALL = '__all__';
const teacherName = (g: StudentFinalGrade) => {
  const p = g.course_period?.teacher?.profile;
  return p ? `${p.first_name} ${p.last_name}`.trim() : null;
};
const courseTitle = (g: StudentFinalGrade) => g.course_period?.course?.title ?? g.course_period?.title ?? '—';

/** One student's final grades, per marking period (web: /admin/grades/student-grades). */
export default function StudentGrades() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.student_grades.${k}`, o);
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const mps = useMarkingPeriods();
  const [student, setStudent] = useState<PickedStudent | null>(null);
  const [mp, setMp] = useState(ALL);
  const studentId = student?.id ?? null;
  const grades = useApi(studentId ? ['admin', 'student-final-grades', studentId] : null, ([, , sid]) => adminGrades.studentGrades(sid as string));

  const rows = (grades.data ?? []).filter((g) => mp === ALL || g.marking_period_id === mp);
  // Group by marking period so "all" stays readable.
  const groups = new Map<string, { title: string; rows: StudentFinalGrade[] }>();
  for (const g of rows) {
    const key = g.marking_period_id;
    const group = groups.get(key) ?? { title: g.marking_period?.title ?? '', rows: [] };
    group.rows.push(g);
    groups.set(key, group);
  }

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={grades.isValidating && !grades.isLoading} onRefresh={() => grades.mutate()} />}>
        <StudentSearchSelect value={student} onChange={setStudent} />
        <Picker value={mp} onChange={setMp} options={[{ value: ALL, label: c('marking_period_placeholder') }, ...mps.options]} />
        {student && grades.isLoading ? <LoadingList rows={4} /> : null}
        {grades.error ? <ErrorState message={grades.error.message} onRetry={() => grades.mutate()} /> : null}
        {student && grades.data && rows.length === 0 ? <EmptyState title={s('no_grades')} /> : null}
        {[...groups.values()].map((group) => (
          <View key={group.title} className="gap-2">
            <Text className="text-muted-foreground text-sm font-semibold">{group.title}</Text>
            <Card className="gap-0 py-0">
              {group.rows.map((g, i) => (
                <View key={g.id}>
                  {i > 0 ? <Separator /> : null}
                  <View className="gap-1 px-4 py-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="flex-1 text-sm font-semibold">{courseTitle(g)}</Text>
                      <Text className="text-lg font-semibold">{g.letter_grade || '—'}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">
                      {[teacherName(g), fmtPercent(g.percent_grade), g.gpa_value != null ? `${c('gpa')} ${fmtGpa(g.gpa_value)}` : null, g.credit_earned != null ? `${c('credits')} ${g.credit_earned}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {g.comment ? <Text className="text-sm">{g.comment}</Text> : null}
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </>
  );
}
