import { Stack } from 'expo-router';
import { Award, BookOpen, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Bar, gradeTone, PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Assignment-based averages per subject with an overall summary (web: /student/grades/student-grades). */
export default function StudentGradebookGrades() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_gg_${key}`, o);
  const grades = useApi(['student', 'grades'], () => student.getStudentGrades());

  if (grades.isLoading) return <LoadingList rows={6} />;
  if (grades.error) return <PortalError title={k('error')} message={grades.error.message} />;
  const list = grades.data ?? [];
  const graded = list.filter((g) => g.average !== null);
  const overall = graded.length ? Math.round(graded.reduce((s, g) => s + (g.average || 0), 0) / graded.length) : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => grades.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {overall !== null ? (
          <>
            <Card>
              <CardContent className="items-center p-5">
                <Icon as={Award} className="text-primary mb-2 size-10" />
                <Text className="text-muted-foreground mb-1 text-sm">{k('overall')}</Text>
                <Text className={cn('text-5xl font-bold', gradeTone(overall).text)}>{`${overall}%`}</Text>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={TrendingUp} className="size-4" />
                  <Text className="font-semibold">{k('summary')}</Text>
                </View>
                <SummaryRow label={k('tracked')} value={`${graded.length} / ${list.length}`} />
                <SummaryRow label={k('above80')} value={String(graded.filter((g) => (g.average || 0) >= 80).length)} tone="text-blue-600" />
                <SummaryRow label={k('below70')} value={String(graded.filter((g) => (g.average || 0) < 70).length)} tone="text-red-600" />
              </CardContent>
            </Card>
          </>
        ) : null}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={BookOpen} className="size-5" />
            <CardTitle>{k('by_subject')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {list.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={BookOpen} className="text-muted-foreground mb-3 size-12" />
                <Text className="text-muted-foreground">{k('empty')}</Text>
              </View>
            ) : (
              list.map((g) => {
                const tone = gradeTone(g.average);
                return (
                  <View key={g.course_period_id} className="border-border bg-card flex-row items-center gap-3 rounded-lg border p-3">
                    <View className="bg-primary/10 rounded-lg p-2">
                      <Icon as={BookOpen} className="text-primary size-4" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" numberOfLines={1}>
                        {g.subject?.name || t('app.st_unknown')}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-2">
                        {g.subject?.code ? (
                          <Badge variant="outline">
                            <Text className="text-xs">{g.subject.code}</Text>
                          </Badge>
                        ) : null}
                        <Text className="text-muted-foreground text-xs">{k('graded', { count: g.graded_count })}</Text>
                      </View>
                      {g.average !== null ? <Bar value={g.average} tone={tone.bar} className="mt-2" /> : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {g.letter_grade ? <Text className={cn('text-xl font-bold', tone.text)}>{g.letter_grade}</Text> : null}
                      <Text className={cn('text-2xl font-bold', tone.text)}>{g.average !== null ? `${g.average}%` : '—'}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className={cn('text-sm font-medium', tone)}>{value}</Text>
    </View>
  );
}
