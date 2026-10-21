import type { Student } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { SearchBar } from '@/components/app/search-bar';
import { Initials } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { useAc } from '@/features/admin/activities';
import { studentFullName } from '@/features/admin/scheduling-tools';
import { useCampus } from '@/features/campus/campus';
import { adminStudents } from '@/lib/api';
import { useApi } from '@/lib/data';
import { useDebounced } from '@/lib/use-debounced';

/** Pick a student to see and change their activities (web: /admin/activities, Student Screen). */
export default function ActivitiesStudentScreen() {
  const a = useAc();
  const { campusId } = useCampus();
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim());
  const res = useApi(['admin', 'activity-students', campusId ?? 'school', search], ([, , , s]) =>
    adminStudents.list(campusId, { limit: 200, search: (s as string) || undefined }),
  );
  const students = res.data ?? [];

  return (
    <>
      <Stack.Screen options={{ title: a('studentScreen') }} />
      <DataList
        items={res.data}
        error={res.error}
        isLoading={res.isLoading}
        isRefreshing={res.isValidating && !res.isLoading}
        onRefresh={() => res.mutate()}
        emptyTitle={a('noStudentsFound')}
        keyExtractor={(s: Student) => s.id}
        header={
          <View className="gap-2 px-4 pt-3 pb-1">
            <SearchBar value={q} onChangeText={setQ} placeholder={a('searchPlaceholder')} />
            {res.data ? <Text className="text-muted-foreground text-sm">{a('studentsFound', { count: students.length })}</Text> : null}
          </View>
        }
        renderItem={(s: Student) => (
          <Pressable
            className="gap-0.5 px-4 py-3"
            onPress={() =>
              router.push({ pathname: '/admin/activities/student', params: { id: s.id, name: studentFullName(s.profile), number: s.student_number } })
            }>
            <View className="flex-row items-center gap-3">
              <Initials name={studentFullName(s.profile) || '?'} />
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold">{studentFullName(s.profile) || '—'}</Text>
                <Text className="text-muted-foreground text-xs">
                  {a('studentTableId')}: {s.student_number} · {a('gradeLevel')}: {s.grade_level ?? '-'}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </>
  );
}
