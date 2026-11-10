import type { DueAssignment } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { CheckCircle, ClipboardList, Clock, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { IconTile, StatTile, StatTiles } from '@/components/app/layout';
import { FlatList } from '@/components/app/lists';
import { ListCard } from '@/components/app/panel';
import { Segmented } from '@/components/app/segmented';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Text } from '@/components/ui/text';
import { longDate } from '@/features/portal/assignments';
import { PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';

type Tab = 'todo' | 'submitted' | 'graded';

/** Pending, submitted and graded assignments with score and feedback (web: /student/grades/student-assignments). */
export default function StudentAssignmentGrades() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_sa_${key}`, o);
  const q = useApi(['student', 'assignments'], () => student.getStudentAssignments());
  const [tab, setTab] = useState<Tab>('todo');
  const [now] = useState(() => Date.now());

  if (q.isLoading) return <LoadingList rows={8} />;
  if (q.error) return <PortalError title={k('error', { message: q.error.message })} />;
  const groups = { todo: q.data?.todo ?? [], submitted: q.data?.submitted ?? [], graded: q.data?.graded ?? [] };

  function status(a: DueAssignment): { label: string; tone: ChipTone } {
    const s = a.submission?.status ?? null;
    if (!s && a.due_date && new Date(a.due_date).getTime() < now) return { label: k('overdue'), tone: 'destructive' };
    if (s === 'graded') return { label: k('graded'), tone: 'success' };
    if (s === 'submitted') return { label: k('submitted'), tone: 'info' };
    return { label: k('pending'), tone: 'warning' };
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <FlatList
        className="bg-background flex-1"
        data={groups[tab]}
        keyExtractor={(a) => a.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => q.mutate()} />}
        contentContainerClassName="gap-2.5 p-4 pb-10"
        ListHeaderComponent={
          <View className="mb-2 gap-3">
            <Text variant="muted">{k('subtitle')}</Text>
            <StatTiles>
              <StatTile icon={Clock} tone="warning" label={k('pending')} value={String(groups.todo.length)} />
              <StatTile icon={CheckCircle} tone="brand" label={k('submitted')} value={String(groups.submitted.length)} />
              <StatTile icon={XCircle} tone="success" label={k('graded')} value={String(groups.graded.length)} />
            </StatTiles>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'todo', label: k('tab_pending', { count: groups.todo.length }) },
                { value: 'submitted', label: k('tab_submitted', { count: groups.submitted.length }) },
                { value: 'graded', label: k('tab_graded', { count: groups.graded.length }) },
              ]}
            />
          </View>
        }
        ListEmptyComponent={<EmptyState icon={ClipboardList} title={k('empty')} />}
        renderItem={({ item: a }) => {
          const st = status(a);
          const marks = a.submission?.marks_obtained;
          return (
            <ListCard onPress={() => router.push({ pathname: '/student/assignments/[id]', params: { id: a.id } })}>
              <IconTile icon={ClipboardList} tone={st.tone === 'success' ? 'success' : st.tone === 'destructive' ? 'destructive' : 'brand'} size={40} />
              <View className="flex-1 gap-1">
                <View className="flex-row items-start gap-2">
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={2}>
                    {a.title}
                  </Text>
                  <StatusChip label={st.label} tone={st.tone} />
                </View>
                <View className="flex-row flex-wrap items-center gap-2">
                  {a.subject?.name ? <StatusChip label={a.subject.name} tone="muted" /> : null}
                  <Text className="text-muted-foreground text-xs">{k('due', { date: longDate(a.due_date) })}</Text>
                </View>
                {marks != null ? <Text className="text-success text-sm font-medium">{k('score', { score: marks, max: a.max_score })}</Text> : null}
                {a.submission?.feedback ? <Text className="text-muted-foreground text-sm italic">{`"${a.submission.feedback}"`}</Text> : null}
              </View>
            </ListCard>
          );
        }}
      />
    </>
  );
}
