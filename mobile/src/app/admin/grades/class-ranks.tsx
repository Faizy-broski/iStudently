import type { GpaRankEntry } from '@studently/api-client';
import { Stack } from 'expo-router';
import { ArrowDown, ArrowUp, Medal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { Badge } from '@/components/ui/badge';
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
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Picker value={markingPeriod} onChange={setMp} options={mps.options} placeholder={c('marking_period')} />
              </View>
              <View className="flex-1">
                <Picker value={grade} onChange={setGrade} options={[{ value: ALL, label: c('all') }, ...(grades.data ?? []).map((g) => ({ value: g.id, label: g.name }))]} />
              </View>
            </View>
            <SearchBar value={q} onChangeText={setQ} placeholder={c('search')} />
            <View className="flex-row flex-wrap gap-1.5">
              {fields.map(([f, label]) => (
                <Pressable key={f} onPress={() => sortBy(f)} className={cn('flex-row items-center gap-1 rounded-full border px-2.5 py-1', sort.field === f ? 'border-primary bg-primary' : 'border-border')}>
                  <Text className={cn('text-xs', sort.field === f ? 'text-primary-foreground' : 'text-foreground')}>{label}</Text>
                  {sort.field === f ? <Icon as={sort.dir === 'asc' ? ArrowUp : ArrowDown} className="text-primary-foreground size-3" /> : null}
                </Pressable>
              ))}
            </View>
            {res.data ? <Text className="text-muted-foreground text-sm">{s('students_found', { count: rows.length })}</Text> : null}
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
            <View className="w-14 flex-row items-center justify-center gap-1">
              {r.class_rank != null && r.class_rank <= 3 ? <Icon as={Medal} className={cn('size-4', r.class_rank === 1 ? 'text-amber-500' : r.class_rank === 2 ? 'text-gray-400' : 'text-amber-700')} /> : null}
              {r.class_rank != null ? (
                <Badge variant="secondary">
                  <Text className="text-xs">#{r.class_rank}</Text>
                </Badge>
              ) : (
                <Text className="text-muted-foreground">—</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="font-medium">{r.student_name}</Text>
              <Text className="text-muted-foreground text-xs">{r.grade_level || '—'}</Text>
            </View>
            <View className="items-end">
              <Text className="text-muted-foreground text-[10px]">
                {s('th_unweighted_gpa')} <Text className="text-foreground font-mono text-sm">{r.unweighted_gpa.toFixed(2)}</Text>
              </Text>
              <Text className="text-muted-foreground text-[10px]">
                {s('th_weighted_gpa')} <Text className="text-foreground font-mono text-sm font-semibold">{r.weighted_gpa.toFixed(2)}</Text>
              </Text>
            </View>
          </View>
        )}
      />
    </>
  );
}
