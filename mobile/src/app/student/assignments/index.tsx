import { router, Stack } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { longDate, teacherOf, useStudentAssignmentList } from '@/features/portal/assignments';
import { PortalError } from '@/features/portal/ui';

/** Every assignment with due/assigned dates, course, teacher and submitted state; search (web: /student/assignments). */
export default function StudentAssignments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_as_${key}`, o);
  const q = useStudentAssignmentList();
  const [search, setSearch] = useState('');

  if (q.isLoading) return <LoadingList rows={8} />;
  if (q.error) return <PortalError title={k('error', { message: q.error.message })} />;
  const term = search.trim().toLowerCase();
  const shown = term ? q.all.filter((a) => a.title?.toLowerCase().includes(term) || a.subject?.name?.toLowerCase().includes(term) || teacherOf(a).toLowerCase().includes(term)) : q.all;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <FlatList
        className="bg-background flex-1"
        data={shown}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => q.mutate()} />}
        contentContainerClassName="gap-2 p-4 pb-10"
        ListHeaderComponent={
          <View className="mb-2 gap-2">
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
            <Text className="text-muted-foreground text-sm">{k('found', { count: shown.length })}</Text>
          </View>
        }
        ListEmptyComponent={<Text className="text-muted-foreground py-16 text-center">{k('empty')}</Text>}
        renderItem={({ item: a }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/student/assignments/[id]', params: { id: a.id } })}
            accessibilityRole="button"
            className="border-border bg-card gap-1.5 rounded-lg border p-3">
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 font-medium text-[#4A90E2]">{a.title}</Text>
              <Icon as={a.submission ? Check : X} className={a.submission ? 'size-5 text-green-600' : 'size-5 text-red-600'} accessibilityLabel={a.submission ? k('submitted') : k('not_submitted')} />
            </View>
            <Text className="text-muted-foreground text-xs">{`${k('course')}: ${a.subject?.name || '—'} · ${k('teacher')}: ${teacherOf(a)}`}</Text>
            <Text className="text-muted-foreground text-xs">{`${k('due')}: ${longDate(a.due_date)} · ${k('assigned')}: ${longDate(a.assigned_date)}`}</Text>
          </Pressable>
        )}
      />
    </>
  );
}
