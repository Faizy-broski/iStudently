import type { Homework } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { ClipboardList, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <Button className="self-start" onPress={() => router.push('/teacher/assignments/create')}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{k('createAssignment')}</Text>
        </Button>
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
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={ClipboardList} className="text-muted-foreground/40 mb-3 size-12" />
              <Text className="text-muted-foreground text-lg font-medium">{k('noAssignmentsFound')}</Text>
              <Text className="text-muted-foreground text-sm">{search ? k('tryDifferentSearch') : k('createFirstAssignmentHint')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((a) => {
            const { days, tone } = dueInfo(a.due_date);
            return (
              <Card key={a.id}>
                <CardContent className="gap-2 p-4">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 font-semibold">{a.title}</Text>
                    <Badge variant="outline">
                      <Text className="text-xs">{k('ptsSuffix', { points: a.max_score })}</Text>
                    </Badge>
                  </View>
                  <Text className="text-muted-foreground text-xs">{[a.subject?.name, a.section?.name, a.section?.grade_level?.name].filter(Boolean).join(' • ')}</Text>
                  {a.description ? (
                    <Text className="text-muted-foreground text-sm" numberOfLines={2}>
                      {a.description}
                    </Text>
                  ) : null}
                  <Text className={cn('text-xs font-medium', tone)}>{`${k('due')}: ${formatDate(a.due_date)}${days < 0 ? ` (${k('overdue')})` : ` (${k('daysCount', { count: days })})`}`}</Text>
                  <View className="flex-row gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onPress={() => router.push({ pathname: '/teacher/assignments/[id]', params: { id: a.id } })}>
                      <Text>{k('view')}</Text>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onPress={() => router.push({ pathname: '/teacher/submissions', params: { assignment: a.id } })}>
                      <Text>{k('submissions')}</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            );
          })
        )}
        {pages > 1 ? (
          <View className="flex-row items-center justify-between">
            <Button variant="outline" size="sm" disabled={page <= 1} onPress={() => setPage(page - 1)}>
              <Text>{t('common.previous')}</Text>
            </Button>
            <Text className="text-sm">{`${page} / ${pages}`}</Text>
            <Button variant="outline" size="sm" disabled={page >= pages} onPress={() => setPage(page + 1)}>
              <Text>{t('common.next')}</Text>
            </Button>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}
