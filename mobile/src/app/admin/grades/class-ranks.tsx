import type { GpaRankEntry } from '@studently/api-client';
import { Stack } from 'expo-router';
import { Medal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { SortChips } from '@/components/app/layout';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useMarkingPeriods } from '@/features/admin/grades';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

const ALL = '__all__';
type Field = 'class_rank' | 'student_name' | 'unweighted_gpa' | 'weighted_gpa';

/** Unweighted/weighted GPA and class rank per marking period, sortable (web: /admin/grades/class-ranks). */
export default function ClassRanks() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.class_ranks.${k}`, o);
  const c = (k: string) => t(`school.grades_module.common.${k}`);
  const { campusId } = useCampus();
  const mps = useMarkingPeriods();
  const grades = useApi(['admin', 'grades', campusId ?? 'school'], () => adminAcademics.grades(campusId));
  const [mp, setMp] = useState<string | null>(null);
  const [grade, setGrade] = useState(ALL);
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const [sort, setSort] = useState<{ field: Field; dir: 'asc' | 'desc' }>({ field: 'class_rank', dir: 'asc' });
  const markingPeriod = mp ?? mps.list.find((m) => m.mp_type === 'PRO')?.id ?? mps.list.find((m) => m.mp_type === 'QTR')?.id ?? mps.list[0]?.id ?? null;
  const res = useApi(markingPeriod ? ['admin', 'gpa-rank', campusId ?? 'school', markingPeriod, grade, search] : null, ([, , , m, g, sq]) =>
    adminGrades.gpaRankList(campusId, { marking_period_id: m as string, grade_level_id: g === ALL ? undefined : (g as string), search: (sq as string) || undefined }),
  );
  const rows = [...(res.data ?? [])].sort((a, b) => {
    const cmp =
      sort.field === 'class_rank' ? (a.class_rank ?? 9999) - (b.class_rank ?? 9999) : sort.field === 'student_name' ? a.student_name.localeCompare(b.student_name) : a[sort.field] - b[sort.field];
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  const sortBy = (field: Field) => setSort((p) => (p.field === field ? { field, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: field === 'class_rank' ? 'asc' : 'desc' }));
  const fields: [Field, string][] = [
    ['class_rank', s('th_class_rank')],
    ['student_name', s('th_student')],
    ['unweighted_gpa', s('th_unweighted_gpa')],
    ['weighted_gpa', s('th_weighted_gpa')],
  ];

  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <DataList
        header={
          <View className="gap-3 p-4">
            <Text className="text-muted-foreground text-sm">{s('subtitle')}</Text>
            <Picker value={markingPeriod} onChange={setMp} options={mps.options} placeholder={c('marking_period')} />
            <FilterChips value={grade} onChange={setGrade} options={[{ value: ALL, label: c('all') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
            <SearchBar value={q} onChangeText={setQ} placeholder={c('search')} />
            <SortChips options={fields} value={sort.field} dir={sort.dir} onChange={(f) => sortBy(f)} />
            {res.data ? <StatusChip label={s('students_found', { count: rows.length })} tone="info" className="self-start px-2.5 py-1" /> : null}
          </View>
        }
        items={res.data ? rows : undefined}
        error={res.error}
        isLoading={res.isLoading || mps.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={c('no_students_found')}
        keyExtractor={(r: GpaRankEntry) => r.student_id}
        renderItem={(r: GpaRankEntry) => (
          <View className="flex-row items-center gap-3 px-4 py-3">
            <View className={cn('size-10 items-center justify-center rounded-full', r.class_rank != null && r.class_rank <= 3 ? 'bg-warning-soft' : 'bg-info-soft')}>
              {r.class_rank != null && r.class_rank <= 3 ? <Icon as={Medal} className="text-warning absolute -top-1 size-3" /> : null}
              <Text className={cn('text-sm font-bold', r.class_rank != null && r.class_rank <= 3 ? 'text-warning' : 'text-brand dark:text-brand-secondary')}>{r.class_rank != null ? `#${r.class_rank}` : '—'}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold" numberOfLines={1}>
                {r.student_name}
              </Text>
              <Text variant="muted" className="text-[11px]">
                {r.grade_level || '—'}
              </Text>
            </View>
            <View className="items-end gap-1">
              <StatusChip label={`${s('th_weighted_gpa')} ${r.weighted_gpa.toFixed(2)}`} tone="info" className="px-2 py-0.5" />
              <Text variant="muted" className="text-[10px]">{`${s('th_unweighted_gpa')} ${r.unweighted_gpa.toFixed(2)}`}</Text>
            </View>
          </View>
        )}
      />
    </>
  );
}
