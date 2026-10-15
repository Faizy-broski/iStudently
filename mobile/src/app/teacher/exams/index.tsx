import type { TeacherExam } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { Award, CheckCircle, Clock, FileText, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { LoadingList } from '@/components/app/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <Text variant="muted">{k('pageSubtitle')}</Text>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" onPress={() => router.push('/teacher/exams/builder')}>
            <Icon as={FileText} className="text-primary size-4" />
            <Text>{t('app.te_ex_builder')}</Text>
          </Button>
          <Button onPress={() => router.push('/teacher/exams/create')}>
            <Icon as={Plus} className="text-primary-foreground size-4" />
            <Text>{k('createExam')}</Text>
          </Button>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Stat icon={FileText} label={k('totalExams')} value={stats.total} tone="bg-blue-100 text-blue-600" />
          <Stat icon={Clock} label={k('upcoming')} value={stats.upcoming} tone="bg-orange-100 text-orange-600" />
          <Stat icon={CheckCircle} label={k('completed')} value={stats.completed} tone="bg-green-100 text-green-600" />
          <Stat icon={Award} label={k('pending')} value={stats.pending} tone="bg-purple-100 text-purple-600" />
        </View>
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
          <Card>
            <CardContent className="items-center py-12">
              <Icon as={Award} className="text-muted-foreground mb-4 size-14" />
              <Text className="mb-2 text-xl font-semibold">{k('noExamsYet')}</Text>
              <Text className="text-muted-foreground mb-4 text-center">{k('createFirstExamHint')}</Text>
              <Button onPress={() => router.push('/teacher/exams/create')}>
                <Icon as={Plus} className="text-primary-foreground size-4" />
                <Text>{k('createExam')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : (
          shown.map((e) => (
            <Card key={e.id}>
              <CardContent className="gap-2 p-4">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="flex-1 font-semibold">{e.exam_name}</Text>
                  {e.is_completed ? (
                    <View className="rounded-full bg-green-100 px-2 py-0.5">
                      <Text className="text-xs font-medium text-green-700">{k('completed')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-muted-foreground text-sm">
                  {[`${e.section?.name ?? ''} - ${e.subject?.name ?? ''}`, tab === 'all' ? e.exam_type?.name : null, e.exam_date ? formatDate(e.exam_date) : null, tab === 'all' ? k('maxPassLabel', { max: e.max_marks, pass: e.passing_marks }) : null]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
                <Button size="sm" className="self-start" variant={tab === 'completed' ? 'outline' : 'default'} onPress={() => open(e)}>
                  {tab === 'completed' ? null : <Icon as={Award} className="text-primary-foreground size-4" />}
                  <Text>{tab === 'completed' ? k('viewResults') : k('grade')}</Text>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}

function Stat({ icon, label, value, tone }: { icon: typeof Clock; label: string; value: number; tone: string }) {
  return (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="flex-row items-center gap-3 p-3">
        <View className={cn('rounded-lg p-2', tone.split(' ')[0])}>
          <Icon as={icon} className={cn('size-5', tone.split(' ')[1])} />
        </View>
        <View>
          <Text className="text-muted-foreground text-xs">{label}</Text>
          <Text className="text-xl font-bold">{String(value)}</Text>
        </View>
      </CardContent>
    </Card>
  );
}
