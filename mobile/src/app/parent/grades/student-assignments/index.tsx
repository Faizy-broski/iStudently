import { router, Stack } from 'expo-router';
import { Check, ClipboardList, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
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
            <View className="flex-row gap-2">
              <Count value={q.todo.length} label={p('pending')} tone="text-orange-500" />
              <Count value={q.done} label={p('submitted')} tone="text-green-600" />
              <Count value={overdue} label={p('overdue')} tone="text-red-500" />
            </View>
            <View className="flex-row items-center gap-2">
              <Icon as={ClipboardList} className="text-foreground size-4" />
              <Text className="text-sm font-semibold">{p('all')}</Text>
            </View>
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('common.search')} />
          </View>
        }
        ListEmptyComponent={<Text className="text-muted-foreground py-16 text-center">{q.all.length ? p('no_match') : k('empty')}</Text>}
        ListFooterComponent={<Text className="text-muted-foreground mt-1 text-xs">{p('shown', { count: shown.length })}</Text>}
        renderItem={({ item: a }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/parent/grades/student-assignments/[id]', params: { id: a.id } })}
            accessibilityRole="button"
            className="border-border bg-card gap-1.5 rounded-lg border p-3">
            <View className="flex-row items-start gap-2">
              <Text className="flex-1 font-medium text-[#4A90E2]">{a.title}</Text>
              <Icon as={a.submission ? Check : X} className={a.submission ? 'size-5 text-green-600' : 'size-5 text-red-500'} accessibilityLabel={a.submission ? k('submitted') : k('not_submitted')} />
            </View>
            <Text className="text-muted-foreground text-xs">{`${k('course')}: ${a.subject?.name || '—'} · ${k('teacher')}: ${teacherOf(a)}`}</Text>
            <Text className="text-muted-foreground text-xs">{`${k('due')}: ${longDate(a.due_date)} · ${k('assigned')}: ${longDate(a.assigned_date)}`}</Text>
          </Pressable>
        )}
      />
    </>
  );
}

function Count({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <Card className="flex-1">
      <CardContent className="items-center py-4">
        <Text className={`text-2xl font-bold ${tone}`}>{String(value)}</Text>
        <Text className="text-muted-foreground mt-1 text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}
