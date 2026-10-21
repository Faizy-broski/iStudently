import type { Homework } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ClipboardList, Eye, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { IconTile, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { dueInfo } from '@/features/teacher/homework';
import { homework } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

type Filter = 'active' | 'upcoming' | 'past' | 'all';
const PAGE = 10;

/** The teacher's homework assignments: search, active / upcoming / past / all, pages, create, view, submissions (web: /teacher/assignments). */
export default function TeacherHomework() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.assignments.${key}`, o);
  const { me } = useSession();
  const staffId = me.status === 'ready' ? (me.me.profile.staff_id ?? null) : null;
  const [filter, setFilter] = useState<Filter>('active');
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 500);
  const [page, setPage] = useState(1);
  const res = useApi(staffId ? ['teacher', 'homework', staffId, filter, search, page] : null, ([, , s, f, term, p]) =>
    homework.teacherList(s as string, { is_archived: false, status: f as string, search: (term as string) || undefined, page: p as number, limit: PAGE }),
  );
  const data = res.data;
  const list: Homework[] = Array.isArray(data) ? data : (data?.data ?? []);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
  const pages = Array.isArray(data) ? 1 : (data?.totalPages ?? 1);

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <View className="flex-row items-start gap-3">
          <Text className="text-muted-foreground flex-1 text-sm">{k('pageSubtitle')}</Text>
          <Button size="sm" onPress={() => router.push('/teacher/assignments/create')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('createAssignment')}</Text>
          </Button>
        </View>
        <SearchBar
          value={q}
          onChangeText={(v) => {
            setQ(v);
            setPage(1);
          }}
          placeholder={k('searchAssignmentsPlaceholder')}
        />
        <FilterChips<Filter>
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={(['active', 'upcoming', 'past', 'all'] as const).map((f) => ({ value: f, label: k(f) }))}
        />
        <Text className="text-muted-foreground text-sm">{k('showingCount', { count: list.length, total })}</Text>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <EmptyState icon={ClipboardList} title={k('noAssignmentsFound')} body={search ? k('tryDifferentSearch') : k('createFirstAssignmentHint')} />
        ) : (
          <Panel>
            {list.map((a, i) => {
              const { days, tone } = dueInfo(a.due_date);
              return (
                <View key={a.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <IconTile icon={ClipboardList} tone={days < 0 ? 'destructive' : days <= 7 ? 'warning' : 'success'} size={40} />
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="flex-1 text-sm font-semibold">{a.title}</Text>
                      <StatusChip label={k('ptsSuffix', { points: a.max_score })} tone="info" />
                    </View>
                    <Text className="text-muted-foreground text-xs">{[a.subject?.name, a.section?.name, a.section?.grade_level?.name].filter(Boolean).join(' • ')}</Text>
                    {a.description ? (
                      <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                        {a.description}
                      </Text>
                    ) : null}
                    <Text className={cn('text-xs font-medium', tone)}>{`${k('due')}: ${formatDate(a.due_date)}${days < 0 ? ` (${k('overdue')})` : ` (${k('daysCount', { count: days })})`}`}</Text>
                    <View className="flex-row flex-wrap gap-2 pt-1">
                      <RowPill icon={Eye} label={k('view')} onPress={() => router.push({ pathname: '/teacher/assignments/[id]', params: { id: a.id } })} />
                      <RowPill icon={Users} label={k('submissions')} onPress={() => router.push({ pathname: '/teacher/submissions', params: { assignment: a.id } })} />
                    </View>
                  </View>
                </View>
              );
            })}
          </Panel>
        )}
        {pages > 1 ? (
          <View className="flex-row items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onPress={() => setPage(page - 1)}>
              <Text>{t('common.previous')}</Text>
            </Button>
            <Text className="text-muted-foreground text-sm font-medium">{`${page} / ${pages}`}</Text>
            <Button variant="outline" size="sm" disabled={page >= pages} onPress={() => setPage(page + 1)}>
              <Text>{t('common.next')}</Text>
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
