import { coursePeriodTeacherName, type GradebookBreakdownEntry } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { BarChart, PieChart } from '@/components/app/charts';
import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useMarkingPeriods } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useScopedCoursePeriods } from '@/features/teacher/course-periods';

type View_ = 'line' | 'pie' | 'list';

/** Grade distribution of a course period by assignment or totals, as chart or list (web: /admin/grades/gradebook). */
export default function GradebookBreakdown() {
  const { t } = useTranslation();
  const g = (k: string) => t(`school.grades_module.gradebook.${k}`);
  const { campusId } = useCampus();
  const mps = useMarkingPeriods();
  const cps = useScopedCoursePeriods();
  const [cp, setCp] = useState<string | null>(null);
  const [mp, setMp] = useState<string | null>(null);
  const [assignment, setAssignment] = useState('totals');
  const [view, setView] = useState<View_>('line');
  const cpId = cp ?? cps.data?.[0]?.id ?? null;
  const mpId = mp ?? mps.selectedQuarterId ?? mps.list.find((m) => m.mp_type === 'QTR')?.id ?? mps.list[0]?.id ?? null;
  const [query, setQuery] = useState<{ cp: string; mp: string | null; assignment: string } | null>(null);
  const options = useApi(cpId ? ['admin', 'gb-assignment-options', cpId, mpId ?? ''] : null, ([, , c, m]) =>
    adminGrades.assignmentOptions({ course_period_id: c as string, marking_period_id: (m as string) || undefined, campus_id: campusId }),
  );
  const res = useApi(query ? ['admin', 'gradebook-breakdown', query.cp, query.mp ?? '', query.assignment] : null, ([, , c, m, a]) =>
    adminGrades.gradebookBreakdown({ course_period_id: c as string, marking_period_id: (m as string) || undefined, assignment_id: a as string, campus_id: campusId }),
  );
  const rows: GradebookBreakdownEntry[] = res.data ?? [];
  const chosen = [{ id: 'totals', title: g('totals') }, ...(options.data ?? []).filter((o) => o.id !== 'totals')].find((o) => o.id === (query?.assignment ?? assignment));

  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: g('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{g('subtitle')}</Text>
        {cps.isLoading || mps.isLoading ? (
          <LoadingList rows={3} />
        ) : (
          <Card>
            <CardContent className="gap-2 pt-4">
              <Label>{g('course_period')}</Label>
              <Picker
                value={cpId}
                onChange={(v) => {
                  setCp(v);
                  setAssignment('totals');
                }}
                options={(cps.data ?? []).map((c) => ({ value: c.id, label: [c.course?.title ?? c.title, c.period?.period_name, coursePeriodTeacherName(c)].filter(Boolean).join(' - ') || c.id.slice(0, 8) }))}
              />
              <Label>{g('marking_period')}</Label>
              <Picker value={mpId} onChange={setMp} options={mps.list.map((m) => ({ value: m.id, label: m.title }))} />
              <Label>{g('assignment')}</Label>
              <Picker value={assignment} onChange={setAssignment} options={[{ value: 'totals', label: g('totals') }, ...(options.data ?? []).filter((o) => o.id !== 'totals').map((o) => ({ value: o.id, label: o.title }))]} />
              <Button onPress={() => cpId && setQuery({ cp: cpId, mp: mpId, assignment })} disabled={!cpId}>
                <Text>{g('go')}</Text>
              </Button>
            </CardContent>
          </Card>
        )}
        {query ? (
          res.isLoading ? (
            <LoadingList rows={4} />
          ) : res.error ? (
            <ErrorState message={res.error.message} onRetry={() => res.mutate()} />
          ) : !rows.length ? (
            <Text className="text-muted-foreground py-8 text-center text-sm">{g('no_students')}</Text>
          ) : (
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">
                  {g('breakdown_label')}: {chosen?.title ?? g('totals')}
                </Text>
                <FilterChips
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'line', label: g('tab_line') },
                    { value: 'pie', label: g('tab_pie') },
                    { value: 'list', label: g('tab_list') },
                  ]}
                />
                {view === 'line' ? (
                  <BarChart categories={rows.map((r) => r.grade_title)} series={[{ name: g('chart_students'), values: rows.map((r) => r.student_count) }]} yLabel={g('chart_students')} />
                ) : view === 'pie' ? (
                  <View className="items-center">
                    <PieChart data={rows.filter((r) => r.student_count > 0).map((r) => ({ name: r.grade_title, value: r.student_count }))} />
                  </View>
                ) : (
                  <View>
                    <View className="flex-row py-1">
                      <Text className="flex-1 text-xs font-semibold">{g('th_title')}</Text>
                      <Text className="w-20 text-end text-xs font-semibold">{g('th_gpa_value')}</Text>
                      <Text className="w-24 text-end text-xs font-semibold">{g('th_num_students')}</Text>
                    </View>
                    {rows.map((r) => (
                      <View key={r.grade_title}>
                        <Separator />
                        <View className="flex-row py-2">
                          <Text className="flex-1 font-medium">{r.grade_title}</Text>
                          <Text className="w-20 text-end">{r.gpa_value}</Text>
                          <Text className="w-24 text-end">{r.student_count}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </CardContent>
            </Card>
          )
        ) : null}
      </ScrollView>
    </View>
  );
}
