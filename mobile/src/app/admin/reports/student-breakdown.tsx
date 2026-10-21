import type { Student } from '@studently/api-client';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart, ChartLegend, PieChart } from '@/components/app/charts';
import { FilterChips } from '@/components/app/filter-chips';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useCampus } from '@/features/campus/campus';
import { adminStudents } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { Users } from 'lucide-react-native';

type Field = 'grade_level' | 'section' | 'gender' | 'blood_group' | 'allergies' | 'status';
const FIELDS: { id: Field; key: string }[] = [
  { id: 'grade_level', key: 'field_grade' },
  { id: 'section', key: 'field_section' },
  { id: 'gender', key: 'field_gender' },
  { id: 'blood_group', key: 'field_blood_group' },
  { id: 'allergies', key: 'field_allergies' },
  { id: 'status', key: 'field_status' },
];

/** All students of the campus (pages of 100), like the web's breakdown (which caps at 1000). */
function useAllStudents(campusId: string | undefined) {
  const [state, setState] = useState<{ students?: Student[]; error?: string }>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({});
      const all: Student[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await adminStudents.list(campusId, { page, limit: 100 });
        if (cancelled) return;
        if (!res.success) return setState({ error: res.error });
        all.push(...(res.data ?? []));
        if (page >= (res.pagination?.totalPages ?? 1)) break;
      }
      setState({ students: all });
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId]);
  return state;
}

/** Students grouped by grade, section, gender, blood group, allergies or status (web: /admin/students/breakdown). */
export default function StudentBreakdown() {
  const { t } = useTranslation();
  const b = (k: string, o?: Record<string, unknown>) => t(`school.students.breakdown.${k}`, o);
  const { campusId } = useCampus();
  const { students, error } = useAllStudents(campusId);
  const [field, setField] = useState<Field>('grade_level');
  const [chart, setChart] = useState<'pie' | 'bar' | 'list'>('pie');

  const value = (s: Student): string => {
    const cf = s.custom_fields ?? {};
    const med = (s.medical_info ?? {}) as { blood_group?: string; allergies?: string[] };
    switch (field) {
      case 'grade_level':
        return s.grade?.name || s.grade_level || b('not_assigned');
      case 'section':
        return s.section?.name || cf.academic?.section_name || b('not_assigned');
      case 'gender': {
        const g = cf.personal?.gender ?? s.profile?.gender;
        return typeof g === 'string' && g ? t(`school.students.fields.${g.toLowerCase()}`, { defaultValue: g }) : b('not_specified');
      }
      case 'blood_group':
        return cf.medical?.bloodGroup || med.blood_group || b('not_specified');
      case 'allergies':
        return (cf.medical?.allergiesList ?? med.allergies ?? []).length > 0 ? b('has_allergies') : b('no_allergies');
      case 'status':
        return s.profile?.is_active !== false ? b('status_active') : b('status_inactive');
    }
  };

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students ?? []) counts.set(value(s), (counts.get(value(s)) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, c) => c.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, field, t]);

  if (error) return <ErrorState message={error} />;
  if (!students) return <LoadingList rows={6} />;
  const total = students.length;
  const fieldLabel = b(FIELDS.find((f) => f.id === field)!.key);

  return (
    <>
      <Stack.Screen options={{ title: b('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <FilterChips<Field> value={field} onChange={setField} options={FIELDS.map((f) => ({ value: f.id, label: b(f.key) }))} />
        <View className="flex-row gap-3">
          <StatTile icon={Users} label={b('total_students')} value={formatNumber(total)} />
          <StatTile icon={Users} label={b('categories')} value={formatNumber(rows.length)} note={rows[0] ? `${b('largest_group')}: ${rows[0].name}` : undefined} />
        </View>
        {rows.length > 1 ? <Text className="text-muted-foreground text-xs">{`${b('smallest_group')}: ${rows[rows.length - 1].name} (${rows[rows.length - 1].count})`}</Text> : null}
        <View>
          <FilterChips
            value={chart}
            onChange={setChart}
            options={[
              { value: 'pie', label: b('chart_pie') },
              { value: 'bar', label: b('chart_column') },
              { value: 'list', label: b('chart_list') },
            ]}
          />
        </View>
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>{b('distribution', { field: fieldLabel })}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3 px-4">
            {rows.length === 0 ? <Text variant="muted">{b('no_data_desc')}</Text> : null}
            {rows.length && chart === 'pie' ? (
              <View className="items-center">
                <PieChart data={rows.map((r) => ({ name: r.name, value: r.count }))} />
              </View>
            ) : null}
            {rows.length && chart === 'bar' ? <BarChart categories={rows.map((r) => r.name)} series={[{ name: b('students_label'), values: rows.map((r) => r.count) }]} /> : null}
            {chart !== 'list' && rows.length ? <ChartLegend series={rows.map((r) => ({ name: `${r.name} (${r.count})` }))} /> : null}
            {(chart === 'list' ? rows : []).map((r) => {
              const pct = total ? (r.count / total) * 100 : 0;
              return (
                <View key={r.name} className="gap-1">
                  <View className="flex-row justify-between gap-3">
                    <Text className="flex-1" numberOfLines={1}>
                      {r.name}
                    </Text>
                    <Text className="text-muted-foreground text-sm">{`${formatNumber(r.count)} · ${pct.toFixed(1)}%`}</Text>
                  </View>
                  <View className="bg-muted h-2 overflow-hidden rounded-full">
                    <View className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </View>
                </View>
              );
            })}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
