import { Stack } from 'expo-router';
import { Award, BookOpen, FileText, MessageSquare, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { InfoBanner } from '@/features/admin/settings-ui';
import { Bar, gradeTone, PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Web getLetterColor: A green, B blue, C yellow, else red. */
const letterTone = (l: string | null) => {
  if (!l) return 'text-muted-foreground';
  const u = l.toUpperCase();
  return u.startsWith('A') ? 'text-green-600' : u.startsWith('B') ? 'text-blue-600' : u.startsWith('C') ? 'text-yellow-600' : 'text-red-600';
};

/** Report card: overall average, per-subject averages and letters, teacher comments (web: /student/grades/report-cards). */
export default function StudentReportCard() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_rc_${key}`, o);
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
          <>
            <Card>
              <CardContent className="items-center p-5">
                <View className="bg-primary/10 mb-3 size-20 items-center justify-center rounded-full">
                  <Icon as={Award} className="text-primary size-10" />
                </View>
                <Text className="text-muted-foreground mb-1 text-sm">{k('overall')}</Text>
                <Text className={cn('text-5xl font-bold', gradeTone(overall).text)}>{`${overall}%`}</Text>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={TrendingUp} className="size-4" />
                  <Text className="font-semibold">{k('overview')}</Text>
                </View>
                <Row label={k('graded')} value={`${graded.length} / ${subjects.length}`} />
                <Row label={k('above80')} value={String(graded.filter((s) => (s.average || 0) >= 80).length)} tone="text-blue-600" />
                <Row label={k('below70')} value={String(graded.filter((s) => (s.average || 0) < 70).length)} tone="text-red-600" />
              </CardContent>
            </Card>
          </>
        ) : null}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={BookOpen} className="size-5" />
            <CardTitle>{k('subjects')}</CardTitle>
          </CardHeader>
          <CardContent className="gap-3">
            {subjects.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={FileText} className="text-muted-foreground mb-3 size-12" />
                <Text className="text-muted-foreground">{k('empty')}</Text>
                <Text className="text-muted-foreground mt-1 text-center text-sm">{k('empty_body')}</Text>
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
                        {s.subject?.name || k('unknown')}
                      </Text>
                      <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
                        {s.subject?.code ? (
                          <Badge variant="outline">
                            <Text className="text-xs">{s.subject.code}</Text>
                          </Badge>
                        ) : null}
                        <Text className="text-muted-foreground text-xs">{k('count', { count: s.grade_count })}</Text>
                      </View>
                      {s.average !== null ? <Bar value={s.average} tone={tone.bar} className="mt-2" /> : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {s.letter_grade ? <Text className={cn('text-xl font-bold', letterTone(s.letter_grade))}>{s.letter_grade}</Text> : null}
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
              <CardTitle>{k('comments')}</CardTitle>
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
        <InfoBanner>{k('note')}</InfoBanner>
      </ScrollView>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className={cn('text-sm font-medium', tone)}>{value}</Text>
    </View>
  );
}
