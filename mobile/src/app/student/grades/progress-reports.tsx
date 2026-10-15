import { Stack } from 'expo-router';
import { BookOpen, MessageSquare, TrendingUp } from 'lucide-react-native';
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

/** Web trend(): label key for an average. */
const trendKey = (avg: number | null) => (avg === null ? 'none' : avg >= 90 ? 'excellent' : avg >= 80 ? 'good' : avg >= 70 ? 'satisfactory' : avg >= 60 ? 'needs' : 'risk');

/** Current progress per subject with status and teacher notes (web: /student/grades/progress-reports). */
export default function StudentProgressReports() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_pr_${key}`, o);
  const trend = (avg: number | null) => t(`app.tr_${trendKey(avg)}`);
  const data = useApi(['student', 'report-card', 'current'], () => student.getStudentReportCard());

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error')} message={data.error.message} />;
  const subjects = data.data?.subjects ?? [];
  const comments = data.data?.comments ?? [];
  const graded = subjects.filter((s) => s.average !== null);
  const overall = graded.length ? Math.round(graded.reduce((sum, s) => sum + (s.average || 0), 0) / graded.length) : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {overall !== null ? (
          <Card>
            <CardContent className="flex-row items-center gap-5 p-4">
              <View className="items-center">
                <Text className={cn('text-5xl font-bold', gradeTone(overall).text)}>{`${overall}%`}</Text>
                <Text className="text-muted-foreground mt-1 text-sm">{k('overall')}</Text>
              </View>
              <View className="flex-1 gap-2">
                <Row label={k('status')} value={trend(overall)} tone={cn('font-semibold', gradeTone(overall).text)} />
                <Row label={k('above80')} value={String(graded.filter((s) => (s.average || 0) >= 80).length)} />
                <Row label={k('attention')} value={String(graded.filter((s) => (s.average || 0) < 70).length)} tone="text-red-600" />
              </View>
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={TrendingUp} className="size-5" />
            <CardTitle>{k('by_subject')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {subjects.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={BookOpen} className="text-muted-foreground mb-3 size-12" />
                <Text className="text-muted-foreground">{k('empty')}</Text>
              </View>
            ) : (
              subjects.map((s) => {
                const tone = gradeTone(s.average);
                return (
                  <View key={s.course_period_id} className="border-border bg-card flex-row items-center gap-3 rounded-lg border p-3">
                    <View className="bg-primary/10 rounded-lg p-2">
                      <Icon as={BookOpen} className="text-primary size-4" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold" numberOfLines={1}>
                        {s.subject?.name || '—'}
                      </Text>
                      <Text className="text-muted-foreground mt-0.5 text-xs">{k('line', { trend: trend(s.average), count: s.grade_count })}</Text>
                      {s.average !== null ? <Bar value={s.average} tone={tone.bar} className="mt-2" /> : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {s.letter_grade ? <Text className={cn('text-xl font-bold', tone.text)}>{s.letter_grade}</Text> : null}
                      <Text className={cn('text-2xl font-bold', tone.text)}>{s.average !== null ? `${s.average}%` : '—'}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>
        {comments.length ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Icon as={MessageSquare} className="size-5" />
              <CardTitle>{k('notes')}</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              {comments.map((c) => (
                <View key={c.id} className="border-border bg-muted/40 gap-2 rounded-lg border p-3">
                  {c.comment?.code ? (
                    <Badge variant="outline" className="self-start">
                      <Text>{c.comment.code}</Text>
                    </Badge>
                  ) : null}
                  <Text className="text-sm">{c.comment?.comment || '—'}</Text>
                </View>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-row justify-between gap-2">
      <Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
      <Text className={cn('text-sm font-medium', tone)}>{value}</Text>
    </View>
  );
}
