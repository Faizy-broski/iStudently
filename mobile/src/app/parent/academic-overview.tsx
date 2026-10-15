import { Stack } from 'expo-router';
import { AlertCircle, Award, BookOpen, Calendar, GraduationCap, RefreshCw, TrendingUp, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const tone = (pct: number) => (pct >= 70 ? 'default' : pct >= 50 ? 'secondary' : 'destructive') as 'default' | 'secondary' | 'destructive';

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
        <Text variant="muted">{k('subtitle')}</Text>
        <Card className="bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="flex-row items-center gap-4 p-4">
            <View className="rounded-full bg-blue-100 p-3 dark:bg-blue-900">
              <Icon as={GraduationCap} className="size-7 text-blue-600 dark:text-blue-400" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold">{`${child.first_name} ${child.last_name}`}</Text>
              <Text className="text-muted-foreground">{`${child.grade_level} • ${child.section}`}</Text>
            </View>
          </CardContent>
        </Card>
        {book.error ? (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="flex-row items-center justify-between gap-2 p-4">
              <View className="flex-1 flex-row items-center gap-2">
                <Icon as={AlertCircle} className="size-5 text-red-600" />
                <Text className="text-red-600">{k('grades_error')}</Text>
              </View>
              <Button variant="outline" size="sm" onPress={() => book.mutate()}>
                <Icon as={RefreshCw} className="size-4" />
                <Text>{k('retry')}</Text>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Section icon={Award} iconClass="text-yellow-500" title={k('recent')}>
          {recent.isLoading ? (
            <LoadingList rows={3} />
          ) : recent.data?.length ? (
            recent.data.map((g, i) => (
              <Row key={i} title={g.subject || k('unknown_subject')} subtitle={g.exam_name || k('exam')}>
                <Badge variant={tone(g.percentage)}>
                  <Text>{`${g.marks_obtained}/${g.total_marks} (${g.percentage}%)`}</Text>
                </Badge>
              </Row>
            ))
          ) : (
            <Empty icon={Award} text={k('no_grades')} />
          )}
        </Section>

        <Section icon={Calendar} iconClass="text-blue-500" title={k('upcoming')}>
          {exams.isLoading ? (
            <LoadingList rows={3} />
          ) : exams.data?.length ? (
            exams.data.map((e, i) => (
              <Row key={e.id ?? i} title={e.exam_name} subtitle={e.subject}>
                <View className="items-end gap-1">
                  {e.exam_type ? (
                    <Badge variant="outline">
                      <Text>{e.exam_type}</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-muted-foreground text-xs">{formatDate(e.date)}</Text>
                </View>
              </Row>
            ))
          ) : (
            <Empty icon={Calendar} text={k('no_exams')} />
          )}
        </Section>

        <Section icon={BookOpen} iconClass="text-green-500" title={k('performance')}>
          {book.data?.length ? (
            book.data.map((s, i) => (
              <View key={i} className="bg-muted/50 gap-2 rounded-lg p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 font-medium">{s.subject}</Text>
                  <Badge variant={tone(s.percentage)}>
                    <Text>{`${s.percentage}%`}</Text>
                  </Badge>
                </View>
                <View className="bg-muted h-2 overflow-hidden rounded-full">
                  <View className={cn('h-2 rounded-full', s.percentage >= 70 ? 'bg-green-500' : s.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500')} style={{ width: `${Math.min(100, s.percentage)}%` }} />
                </View>
                <Text className="text-muted-foreground text-xs">{t('app.pa_ao_marks', { current: s.current_marks, total: s.total_marks })}</Text>
              </View>
            ))
          ) : (
            <Empty icon={TrendingUp} text={k('no_performance')} />
          )}
        </Section>
      </ScrollView>
    </>
  );
}

function Section({ icon, iconClass, title, children }: { icon: LucideIcon; iconClass: string; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Icon as={icon} className={cn('size-5', iconClass)} />
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">{children}</CardContent>
    </Card>
  );
}

function Row({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View className="bg-muted/50 flex-row items-center justify-between gap-2 rounded-lg p-3">
      <View className="flex-1">
        <Text className="font-medium">{title}</Text>
        {subtitle ? <Text className="text-muted-foreground text-sm">{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Empty({ icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <View className="items-center py-6">
      <Icon as={icon} className="text-muted-foreground/40 mb-3 size-12" />
      <Text className="text-muted-foreground">{text}</Text>
    </View>
  );
}
