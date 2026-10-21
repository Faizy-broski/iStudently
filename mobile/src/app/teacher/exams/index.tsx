import type { TeacherExam } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Award, CheckCircle, Clock, FileText, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { IconTile, RowPill, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTeacherExams } from '@/features/teacher/exams';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'all' | 'upcoming' | 'completed';

/** The teacher's exams: counts, all / upcoming / completed, create, grade (web: /teacher/exams). */
export default function TeacherExams() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPages.exams.${key}`, o);
  const res = useTeacherExams();
  const [tab, setTab] = useState<Tab>('all');
  const [now] = useState(() => Date.now());
  const all = res.data ?? [];
  const isUpcoming = (e: TeacherExam) => !e.is_completed && !!e.exam_date && new Date(e.exam_date).getTime() > now;
  const stats = { total: all.length, upcoming: all.filter(isUpcoming).length, completed: all.filter((e) => e.is_completed).length, pending: all.filter((e) => !e.is_completed).length };
  const shown = tab === 'upcoming' ? all.filter(isUpcoming) : tab === 'completed' ? all.filter((e) => e.is_completed) : all;
  const open = (e: TeacherExam) => router.push({ pathname: '/teacher/exams/[id]', params: { id: e.id } });

  return (
    <>
      <Stack.Screen options={{ title: k('pageTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('pageSubtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" onPress={() => router.push('/teacher/exams/builder')}>
            <Icon as={FileText} className="text-brand dark:text-brand-secondary size-4" />
            <Text>{t('app.te_ex_builder')}</Text>
          </Button>
          <Button onPress={() => router.push('/teacher/exams/create')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('createExam')}</Text>
          </Button>
        </View>
        <StatTiles>
          <StatTile icon={FileText} label={k('totalExams')} value={String(stats.total)} tone="brand" />
          <StatTile icon={Clock} label={k('upcoming')} value={String(stats.upcoming)} tone="warning" />
          <StatTile icon={CheckCircle} label={k('completed')} value={String(stats.completed)} tone="success" />
          <StatTile icon={Award} label={k('pending')} value={String(stats.pending)} tone="destructive" />
        </StatTiles>
        <FilterChips<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: k('allExams') },
            { value: 'upcoming', label: k('upcoming') },
            { value: 'completed', label: k('completed') },
          ]}
        />
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !all.length ? (
          <EmptyState icon={Award} title={k('noExamsYet')} body={k('createFirstExamHint')} actionLabel={k('createExam')} onAction={() => router.push('/teacher/exams/create')} />
        ) : shown.length ? (
          <Panel>
            {shown.map((e, i) => (
              <View key={e.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < shown.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <IconTile icon={e.is_completed ? CheckCircle : Award} tone={e.is_completed ? 'success' : 'brand'} size={40} />
                <View className="flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="flex-1 text-sm font-semibold">{e.exam_name}</Text>
                    {e.is_completed ? <StatusChip label={k('completed')} tone="success" /> : null}
                  </View>
                  <Text className="text-muted-foreground text-xs">
                    {[`${e.section?.name ?? ''} - ${e.subject?.name ?? ''}`, tab === 'all' ? e.exam_type?.name : null, e.exam_date ? formatDate(e.exam_date) : null, tab === 'all' ? k('maxPassLabel', { max: e.max_marks, pass: e.passing_marks }) : null]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                  <View className="flex-row pt-1">
                    <RowPill icon={tab === 'completed' ? undefined : Award} tone={tab === 'completed' ? 'muted' : 'brand'} label={tab === 'completed' ? k('viewResults') : k('grade')} onPress={() => open(e)} />
                  </View>
                </View>
              </View>
            ))}
          </Panel>
        ) : null}
      </ScrollView>
    </>
  );
}
