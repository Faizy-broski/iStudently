import { Stack } from 'expo-router';
import { GraduationCap } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
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
        <View className="flex-row items-center gap-2">
          <Icon as={GraduationCap} className="size-6 text-[#57A3CC]" />
          <Text className="flex-1 text-sm">
            {`${child.first_name} ${child.last_name}`}
            <Text className="text-sm font-medium">{` — ${child.campus_name}`}</Text>
          </Text>
        </View>
        <Picker value={mp} onChange={setMp} options={[{ value: 'all', label: k('all_mps') }, ...(mps.data ?? []).map((m) => ({ value: m.id, label: m.title }))]} />
        <SearchBar value={search} onChangeText={setSearch} placeholder={k('search')} />
        <Text className="text-sm font-medium text-[#0369a1]">{k('found', { count: rows.length })}</Text>
        {grades.isLoading ? (
          <LoadingList rows={4} />
        ) : !rows.length ? (
          <Text className="text-muted-foreground py-10 text-center">{k('none')}</Text>
        ) : (
          <Card>
            <CardContent className="px-4 py-1">
              {rows.map((g) => (
                <View key={g.id} className="border-border gap-1 border-b py-3 last:border-b-0">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="font-medium">{g.course}</Text>
                      <Text className="text-muted-foreground text-xs">{g.teacher || '—'}</Text>
                    </View>
                    <Text className="text-primary text-lg font-semibold">{g.letter || '—'}</Text>
                  </View>
                  <View className="flex-row gap-4">
                    <Text className="text-xs">{`%: ${g.percent != null ? `${g.percent.toFixed(1)}%` : '—'}`}</Text>
                    <Text className="text-xs">{`${k('gpa_points')}: ${g.points != null ? g.points.toFixed(2) : '—'}`}</Text>
                  </View>
                  {g.comment ? <Text className="text-muted-foreground text-sm">{g.comment}</Text> : null}
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
