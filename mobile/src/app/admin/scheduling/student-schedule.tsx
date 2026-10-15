import type { Student } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { Text } from '@/components/ui/text';
import { studentFullName, useCampusStudents } from '@/features/admin/scheduling-tools';
import { useRoleBase } from '@/features/portal/role-base';

/** Pick a student to see and change their schedule (web: /admin/scheduling/student-schedule and /teacher/scheduling/schedule, StudentScheduleList; teachers see their own students). */
export default function StudentScheduleList() {
  const { t } = useTranslation();
  const s = (k: string, o?: Record<string, unknown>) => t(`school.scheduling.student_schedule.${k}`, o);
  const res = useCampusStudents();
  const role = useRoleBase();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = (res.data ?? []).filter((x) => !term || studentFullName(x.profile).toLowerCase().includes(term) || x.student_number.toLowerCase().includes(term) || (x.grade_level ?? '').toLowerCase().includes(term));
  return (
    <>
      <Stack.Screen options={{ title: s('title') }} />
      <DataList
        items={res.data ? shown : undefined}
        error={res.error}
        isLoading={res.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={s('no_students_found')}
        keyExtractor={(x: Student) => x.id}
        header={
          <View className="gap-2 px-4 pt-3 pb-1">
            <SearchBar value={q} onChangeText={setQ} placeholder={s('search_placeholder')} />
            {res.data ? <Text className="text-muted-foreground text-sm">{s('found_students', { count: shown.length })}</Text> : null}
          </View>
        }
        renderItem={(x: Student) => (
          <Pressable
            className="gap-0.5 px-4 py-3"
            onPress={() => router.push(role.href('/scheduling/student-schedule-detail', { id: x.id, name: studentFullName(x.profile), number: x.student_number, grade: x.grade_level ?? '' }))}>
            <Text className="text-primary font-medium">{studentFullName(x.profile) || '—'}</Text>
            <Text className="text-muted-foreground text-xs">
              {s('th_student_number')}: {x.student_number} · {s('th_grade_level')}: {x.grade_level || '—'}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}
