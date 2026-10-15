import type { Student } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { Text } from '@/components/ui/text';
import { studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';

/** Pick a student to edit their historical grades (web: /admin/grades/historical-grades). */
export default function HistoricalGradesStudents() {
  const { t } = useTranslation();
  const h = (k: string, o?: Record<string, unknown>) => t(`school.grades_module.historical_grades.${k}`, o);
  const res = useCampusStudents();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = (res.data ?? []).filter(
    (s) => !term || studentFullName(s.profile).toLowerCase().includes(term) || s.student_number.toLowerCase().includes(term) || (s.grade_level ?? '').toLowerCase().includes(term),
  );
  return (
    <>
      <Stack.Screen options={{ title: h('title') }} />
      <DataList
        items={res.data ? shown : undefined}
        error={res.error}
        isLoading={res.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={t('school.grades_module.common.no_students_found')}
        keyExtractor={(s: Student) => s.id}
        header={
          <View className="gap-2 px-4 pt-3 pb-1">
            <Text className="text-muted-foreground text-sm">{h('subtitle')}</Text>
            <SearchBar value={q} onChangeText={setQ} placeholder={h('search_placeholder')} />
            {res.data ? <Text className="text-muted-foreground text-sm">{t('school.grades_module.common.students_found', { count: shown.length })}</Text> : null}
          </View>
        }
        renderItem={(s: Student) => (
          <Pressable
            className="gap-0.5 px-4 py-3"
            onPress={() =>
              router.push({ pathname: '/admin/grades/historical-grades/student', params: { id: s.id, name: studentFullName(s.profile), number: s.student_number, grade: s.grade_level ?? '' } })
            }>
            <Text className="text-primary font-medium">{studentFullName(s.profile) || '—'}</Text>
            <Text className="text-muted-foreground text-xs">
              {h('th_student_id')}: {s.student_number} · {h('th_grade_level')}: {s.grade_level || '—'}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}
