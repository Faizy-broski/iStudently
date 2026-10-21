import { Stack } from 'expo-router';
import { AlertCircle, Award, BookOpen, Calendar, GraduationCap, RefreshCw, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, RowItem, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const tone = (pct: number): ChipTone => (pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'destructive');

/** Recent grades, upcoming exams and per-subject performance of the selected child (web: /parent/academics, from the dashboard). */
export default function ParentAcademicOverview() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_ao_${key}`);
  const { child, childId } = useChild();
  const book = useApi(childId ? ['parent', 'gradebook', childId] : null, ([, , id]) => parent.getGradebook(id as string));
  const recent = useApi(childId ? ['parent', 'recent-grades', childId, 10] : null, ([, , id]) => parent.getRecentGrades(id as string, 10));
  const exams = useApi(childId ? ['parent', 'upcoming-exams', childId, 5] : null, ([, , id]) => parent.getUpcomingExams(id as string, 5));

  if (!child) return <NoChild />;
  if (book.isLoading) return <LoadingList rows={5} />;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-4 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([book.mutate(), recent.mutate(), exams.mutate()])} />}>
        <HeroCard>
          <View className="flex-row items-center gap-3">
            <View className="size-12 items-center justify-center rounded-full bg-white/15">
              <Icon as={GraduationCap} className="size-6 text-white" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">{`${child.first_name} ${child.last_name}`}</Text>
              <Text className="text-xs text-white/80">{`${child.grade_level} • ${child.section}`}</Text>
            </View>
          </View>
          <Text className="text-xs text-white/80">{k('subtitle')}</Text>
        </HeroCard>
        {book.error ? (
          <Panel className="border-destructive/30 bg-destructive-soft flex-row items-center justify-between gap-2 p-4">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon as={AlertCircle} className="size-5 text-destructive" />
              <Text className="text-destructive flex-1 text-sm">{k('grades_error')}</Text>
            </View>
            <Button variant="outline" size="sm" onPress={() => book.mutate()}>
              <Icon as={RefreshCw} className="size-4" />
              <Text>{k('retry')}</Text>
            </Button>
          </Panel>
        ) : null}

        <Section title={k('recent')}>
          {recent.isLoading ? (
            <LoadingList rows={3} />
          ) : recent.data?.length ? (
            <Panel>
              {recent.data.map((g, i, arr) => (
                <RowItem
                  key={i}
                  leading={<IconTile icon={Award} tone="warning" size={40} />}
                  title={g.subject || k('unknown_subject')}
                  meta={g.exam_name || k('exam')}
                  trailing={<StatusChip label={`${g.marks_obtained}/${g.total_marks} (${g.percentage}%)`} tone={tone(g.percentage)} />}
                  last={i === arr.length - 1}
                />
              ))}
            </Panel>
          ) : (
            <EmptyState icon={Award} title={k('no_grades')} />
          )}
        </Section>

        <Section title={k('upcoming')}>
          {exams.isLoading ? (
            <LoadingList rows={3} />
          ) : exams.data?.length ? (
            <Panel>
              {exams.data.map((e, i, arr) => (
                <RowItem
                  key={e.id ?? i}
                  leading={<IconTile icon={Calendar} size={40} />}
                  title={e.exam_name}
                  meta={[e.subject, formatDate(e.date)].filter(Boolean).join(' · ')}
                  trailing={e.exam_type ? <StatusChip label={e.exam_type} tone="info" /> : undefined}
                  last={i === arr.length - 1}
                />
              ))}
            </Panel>
          ) : (
            <EmptyState icon={Calendar} title={k('no_exams')} />
          )}
        </Section>

        <Section title={k('performance')}>
          {book.data?.length ? (
            <Panel>
              {book.data.map((s, i, arr) => (
                <RowItem
                  key={i}
                  leading={<IconTile icon={BookOpen} tone="success" size={40} />}
                  title={s.subject}
                  meta={t('app.pa_ao_marks', { current: s.current_marks, total: s.total_marks })}
                  trailing={<StatusChip label={`${s.percentage}%`} tone={tone(s.percentage)} />}
                  last={i === arr.length - 1}>
                  <View className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <View className={cn('h-1.5 rounded-full', s.percentage >= 70 ? 'bg-success' : s.percentage >= 50 ? 'bg-warning' : 'bg-destructive')} style={{ width: `${Math.min(100, s.percentage)}%` }} />
                  </View>
                </RowItem>
              ))}
            </Panel>
          ) : (
            <EmptyState icon={TrendingUp} title={k('no_performance')} />
          )}
        </Section>
      </ScrollView>
    </>
  );
}
