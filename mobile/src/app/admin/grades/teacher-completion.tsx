import { Stack } from 'expo-router';
import { CheckCircle2, Circle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { Initials, UsageBar } from '@/components/app/layout';
import { StatusChip } from '@/components/app/status-chip';
import { Picker } from '@/components/app/picker';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useMarkingPeriods } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

const ALL = '__all__';

/** Which teachers have finished entering grades, per period (web: /admin/grades/teacher-completion). */
export default function TeacherCompletion() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.teacher_completion.${k}`, o);
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const { campusId } = useCampus();
  const mps = useMarkingPeriods();
  const [mp, setMp] = useState<string | null>(null);
  const [period, setPeriod] = useState(ALL);
  const markingPeriod = mp ?? mps.selectedQuarterId ?? mps.list.find((m) => m.mp_type === 'QTR')?.id ?? mps.list[0]?.id ?? null;
  const periods = useApi(['admin', 'school-periods', campusId ?? 'school'], () => adminGrades.schoolPeriods(campusId));
  const list = useApi(markingPeriod ? ['admin', 'teacher-completion', campusId ?? 'school', markingPeriod, period] : null, ([, , cid, m, p]) =>
    adminGrades.teacherCompletion(cid === 'school' ? null : (cid as string), { marking_period_id: m as string, school_period_id: p === ALL ? undefined : (p as string) }),
  );

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={
            <View className="gap-3 p-4">
              <Picker value={markingPeriod} onChange={setMp} options={mps.options} placeholder={c('marking_period')} />
              <FilterChips value={period} onChange={setPeriod} options={[{ value: ALL, label: c('all') }, ...(periods.data ?? []).map((p) => ({ value: p.id, label: p.title ?? p.period_name ?? p.short_name ?? '' }))]} />
              {list.data ? <StatusChip label={s('teachers_found', { count: list.data.length })} tone="info" className="self-start px-2.5 py-1" /> : null}
            </View>
          }
          items={list.data}
          error={list.error}
          isLoading={list.isLoading || mps.isLoading}
          isRefreshing={list.isValidating && !list.isLoading}
          onRefresh={() => list.mutate()}
          emptyTitle={s('no_teachers_found')}
          keyExtractor={(x) => x.staff_id}
          renderItem={(x) => {
            const entries = Object.entries(x.periods);
            const done = entries.filter(([, p]) => p.completed).length;
            return (
              <View className="gap-2 px-4 py-3">
                <View className="flex-row items-center gap-3">
                  <Initials name={x.teacher_name} tone={done === entries.length ? 'success' : 'brand'} />
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
                    {x.teacher_name}
                  </Text>
                  <StatusChip label={`${done}/${entries.length}`} tone={done === entries.length ? 'success' : done ? 'warning' : 'muted'} className="px-2 py-0.5" />
                </View>
                <UsageBar used={done} total={entries.length || 1} />
                {entries.map(([pid, p]) => (
                  <View key={pid} className="flex-row items-center gap-2">
                    <Icon as={p.completed ? CheckCircle2 : Circle} className={p.completed ? 'text-success size-4' : 'text-muted-foreground size-4'} />
                    <Text className="flex-1 text-sm">{[p.period_title, p.course_period_title].filter(Boolean).join(' · ')}</Text>
                  </View>
                ))}
              </View>
            );
          }}
        />
      </View>
    </>
  );
}
