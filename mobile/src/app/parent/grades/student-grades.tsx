import { Stack } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { IconTile, Initials, RowItem } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { StatusChip } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { adminGrades } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The selected child's final grades per course, by marking period, searchable (web: /parent/grades/student-grades). */
export default function ParentStudentGrades() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pa_sg_${key}`, o);
  const { child, childId } = useChild();
  const campusId = child?.campus_id ?? null;
  const mps = useApi(campusId ? ['parent', 'marking-periods', campusId] : null, ([, , c]) => adminGrades.markingPeriods(c as string));
  const grades = useApi(childId ? ['parent', 'final-grades', childId] : null, ([, , id]) => adminGrades.studentGrades(id as string));
  const [mp, setMp] = useState('all');
  const [search, setSearch] = useState('');

  if (!child) return <NoChild />;
  const q = search.trim().toLowerCase();
  const rows = (grades.data ?? [])
    .filter((g) => mp === 'all' || g.marking_period_id === mp)
    .map((g) => {
      const tp = g.course_period?.teacher?.profile;
      return {
        id: g.id,
        course: g.course_period?.course?.title || g.course_period?.title || '—',
        teacher: tp ? `${tp.first_name ?? ''} ${tp.last_name ?? ''}`.trim() : '',
        percent: g.percent_grade != null ? Number(g.percent_grade) : null,
        letter: g.letter_grade ?? null,
        points: g.gpa_value != null ? Number(g.gpa_value) : g.grade_points != null ? Number(g.grade_points) : null,
        comment: g.comment ?? null,
      };
    })
    .filter((g) => !q || g.course.toLowerCase().includes(q) || g.teacher.toLowerCase().includes(q));

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([grades.mutate(), mps.mutate()])} />}>
        <Panel>
          <RowItem leading={<IconTile icon={GraduationCap} size={40} />} title={`${child.first_name} ${child.last_name}`} meta={child.campus_name} last />
        </Panel>
        <Picker value={mp} onChange={setMp} options={[{ value: 'all', label: k('all_mps') }, ...(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))]} />
        <SearchBar value={search} onChangeText={setSearch} placeholder={k('search')} />
        <Text className="text-muted-foreground text-xs font-medium">{k('found', { count: rows.length })}</Text>
        {grades.isLoading ? (
          <LoadingList rows={4} />
        ) : !rows.length ? (
          <EmptyState icon={GraduationCap} title={k('none')} />
        ) : (
          <Panel>
            {rows.map((g, i) => (
              <RowItem
                key={g.id}
                leading={<Initials name={g.course} size={40} />}
                title={g.course}
                meta={g.teacher || '—'}
                trailing={
                  <View className="bg-info-soft min-w-11 items-center rounded-xl px-2 py-1.5">
                    <Text className="text-brand dark:text-brand-secondary text-base font-bold">{g.letter || '—'}</Text>
                  </View>
                }
                last={i === rows.length - 1}>
                <View className="flex-row flex-wrap gap-1.5">
                  <StatusChip label={`%: ${g.percent != null ? `${g.percent.toFixed(1)}%` : '—'}`} tone="muted" />
                  <StatusChip label={`${k('gpa_points')}: ${g.points != null ? g.points.toFixed(2) : '—'}`} tone="muted" />
                </View>
                {g.comment ? <Text className="text-muted-foreground text-xs">{g.comment}</Text> : null}
              </RowItem>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}
