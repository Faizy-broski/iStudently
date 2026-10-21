import { router, Stack } from 'expo-router';
import { AlertTriangle, Check, ClipboardList, Clock, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, RefreshControl, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { IconTile, StatTile, StatTiles } from '@/components/app/layout';
import { ListCard } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useChildAssignments } from '@/features/parent/assignments';
import { NoChild, useChild } from '@/features/parent/child';
import { longDate, teacherOf } from '@/features/portal/assignments';
import { PortalError } from '@/features/portal/ui';

/** The selected child's assignments with pending / submitted / overdue counts, read-only (web: /parent/grades/student-assignments). */
export default function ParentAssignments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_as_${key}`, o);
  const p = (key: string, o?: Record<string, unknown>) => t(`app.pa_as_${key}`, o);
  const { child, childId } = useChild();
  const q = useChildAssignments(childId);
  const [search, setSearch] = useState('');
  const [now] = useState(() => Date.now());

  if (!child) return <NoChild />;
  if (q.isLoading) return <LoadingList rows={8} />;
  if (q.error) return <PortalError title={k('error', { message: q.error.message })} />;
  const term = search.trim().toLowerCase();
  const shown = term ? q.all.filter((a) => a.title?.toLowerCase().includes(term) || a.subject?.name?.toLowerCase().includes(term) || teacherOf(a).toLowerCase().includes(term)) : q.all;
  const overdue = q.todo.filter((a) => a.due_date && new Date(a.due_date).getTime() < now).length;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <FlatList
        className="bg-background flex-1"
        data={shown}
        keyExtractor={(a) => a.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => q.mutate()} />}
        contentContainerClassName="gap-2 p-4 pb-10"
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <Text variant="muted">{p('subtitle', { name: `${child.first_name} ${child.last_name}`, campus: child.campus_name })}</Text>
            <StatTiles>
              <StatTile icon={Clock} tone="warning" label={p('pending')} value={String(q.todo.length)} />
              <StatTile icon={Check} tone="success" label={p('submitted')} value={String(q.done)} />
              <StatTile icon={AlertTriangle} tone="destructive" label={p('overdue')} value={String(overdue)} />
            </StatTiles>
            <Text className="text-base font-semibold">{p('all')}</Text>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon={ClipboardList} title={q.all.length ? p('no_match') : k('empty')} />}
        ListFooterComponent={<Text className="text-muted-foreground mt-1 text-xs">{p('shown', { count: shown.length })}</Text>}
        renderItem={({ item: a }) => (
          <ListCard onPress={() => router.push({ pathname: '/parent/grades/student-assignments/[id]', params: { id: a.id } })}>
            <IconTile icon={ClipboardList} tone={a.submission ? 'success' : 'warning'} size={40} />
            <View className="flex-1 gap-0.5">
              <View className="flex-row items-start gap-2">
                <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>
                  {a.title}
                </Text>
                <View
                  className={a.submission ? 'bg-success-soft size-6 items-center justify-center rounded-full' : 'bg-destructive-soft size-6 items-center justify-center rounded-full'}
                  accessibilityLabel={a.submission ? k('submitted') : k('not_submitted')}>
                  <Icon as={a.submission ? Check : X} className={a.submission ? 'size-3.5 text-success' : 'size-3.5 text-destructive'} />
                </View>
              </View>
              <Text className="text-muted-foreground text-[11px]">{`${k('course')}: ${a.subject?.name || '—'} · ${k('teacher')}: ${teacherOf(a)}`}</Text>
              <Text className="text-muted-foreground text-[11px]">{`${k('due')}: ${longDate(a.due_date)} · ${k('assigned')}: ${longDate(a.assigned_date)}`}</Text>
            </View>
          </ListCard>
        )}
      />
    </>
  );
}
