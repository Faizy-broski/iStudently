import type { Student } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { PersonAvatar } from '@/components/app/person-avatar';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
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
            {res.data ? <StatusChip label={s('found_students', { count: shown.length })} tone="info" className="self-start px-2.5 py-1" /> : null}
          </View>
        }
        renderItem={(x: Student) => (
          <Pressable
            className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
            onPress={() => router.push(role.href('/scheduling/student-schedule-detail', { id: x.id, name: studentFullName(x.profile), number: x.student_number, grade: x.grade_level ?? '' }))}>
            <PersonAvatar url={x.profile?.profile_photo_url ?? x.profile?.avatar_url} name={studentFullName(x.profile) || x.student_number} size={40} />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold" numberOfLines={1}>
                {studentFullName(x.profile) || '—'}
              </Text>
              <Text variant="muted" className="text-[11px]">
                {[x.student_number, x.grade_level].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Icon flipRtl as={ChevronRight} className="text-muted-foreground size-4" />
          </Pressable>
        )}
      />
    </>
  );
}
