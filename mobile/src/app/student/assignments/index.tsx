import { router, Stack } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { ListCard } from '@/components/app/panel';
import { SearchBar } from '@/components/app/search-bar';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
        contentContainerClassName="gap-2.5 p-4 pb-10"
        ListHeaderComponent={
          <View className="mb-2 gap-2">
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
            <Text className="text-muted-foreground text-sm">{k('found', { count: shown.length })}</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon={ClipboardList} title={k('empty')} />}
        renderItem={({ item: a }) => (
          <ListCard onPress={() => router.push({ pathname: '/student/assignments/[id]', params: { id: a.id } })}>
            <IconTile icon={ClipboardList} tone={a.submission ? 'success' : 'brand'} size={40} />
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold" numberOfLines={2}>
                {a.title}
              </Text>
              <Text className="text-muted-foreground text-xs">{`${k('course')}: ${a.subject?.name || '—'} · ${k('teacher')}: ${teacherOf(a)}`}</Text>
              <Text className="text-muted-foreground text-xs">{`${k('due')}: ${longDate(a.due_date)} · ${k('assigned')}: ${longDate(a.assigned_date)}`}</Text>
              <StatusChip label={a.submission ? k('submitted') : k('not_submitted')} tone={a.submission ? 'success' : 'destructive'} className="mt-1 self-start" />
            </View>
          </ListCard>
        )}
      />
    </>
  );
}
