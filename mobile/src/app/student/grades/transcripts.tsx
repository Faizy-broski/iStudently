import { Stack } from 'expo-router';
import { BookOpen, GraduationCap } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { gradeTone, PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

const monthDay = (iso: string) => new Date(iso).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'short', day: 'numeric' });

/** Every graded item per subject with score, type, due date and late/missing/exempt (web: /student/grades/transcripts). */
export default function StudentTranscript() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_tr_${key}`, o);
  const data = useApi(['student', 'grades'], () => student.getStudentGrades());

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error')} message={data.error.message} />;
  const groups = data.data ?? [];
  const graded = groups.filter((g) => g.graded_count > 0);
  const overall = graded.length ? Math.round(graded.reduce((s, g) => s + (g.average || 0), 0) / graded.length) : null;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="muted" className="flex-1">
            {k('subtitle')}
          </Text>
          {overall !== null ? (
            <View className="items-end">
              <Text className="text-muted-foreground text-xs">{k('cumulative')}</Text>
              <Text className={cn('text-3xl font-bold', gradeTone(overall).text)}>{`${overall}%`}</Text>
            </View>
          ) : null}
        </View>
        {groups.length ? (
          <View className="flex-row flex-wrap gap-2">
            <Stat value={groups.length} label={k('subjects')} />
            <Stat value={groups.reduce((s, g) => s + g.graded_count, 0)} label={k('items')} />
            <Stat value={graded.filter((g) => (g.average || 0) >= 80).length} label={k('above80')} tone="text-green-600" />
            <Stat value={graded.filter((g) => (g.average || 0) < 70).length} label={k('below70')} tone="text-red-600" />
          </View>
        ) : null}
        {groups.length === 0 ? (
          <Card>
            <CardContent className="items-center p-10">
              <Icon as={GraduationCap} className="text-muted-foreground mb-3 size-14" />
              <Text className="mb-1 text-lg font-semibold">{k('empty')}</Text>
              <Text className="text-muted-foreground text-center text-sm">{k('empty_body')}</Text>
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.course_period_id}>
              <CardHeader className="flex-row items-center justify-between gap-3">
                <View className="flex-1 flex-row items-center gap-3">
                  <View className="bg-primary/10 rounded-lg p-2">
                    <Icon as={BookOpen} className="text-primary size-5" />
                  </View>
                  <View className="flex-1">
                    <CardTitle className="text-base">{group.subject?.name || t('app.st_rc_unknown')}</CardTitle>
                    {group.subject?.code ? (
                      <Badge variant="outline" className="mt-0.5 self-start">
                        <Text className="text-xs">{group.subject.code}</Text>
                      </Badge>
                    ) : null}
                  </View>
                </View>
                <View className="items-end">
                  <View className="flex-row items-center gap-2">
                    {group.letter_grade ? <Text className="text-primary text-lg font-bold">{group.letter_grade}</Text> : null}
                    <Text className={cn('text-2xl font-bold', gradeTone(group.average).text)}>{group.average !== null ? `${group.average}%` : '—'}</Text>
                  </View>
                  <Text className="text-muted-foreground text-xs">{k('graded', { done: group.graded_count, total: group.total_assignments })}</Text>
                </View>
              </CardHeader>
              {group.grades.length ? (
                <CardContent>
                  {group.grades.map((g) => {
                    const max = g.assignment?.points;
                    const score = g.is_exempt ? '—' : g.points !== null ? `${g.points}/${max ?? '?'}` : k('not_graded');
                    const pct = max && g.points !== null && !g.is_exempt ? Math.round((g.points / max) * 100) : null;
                    const status = g.is_exempt ? ['bg-gray-100', 'text-gray-600', k('exempt')] : g.is_missing ? ['bg-red-100', 'text-red-600', k('missing')] : g.is_late ? ['bg-orange-100', 'text-orange-600', k('late')] : null;
                    return (
                      <View key={g.id} className="border-border gap-1 border-t py-2">
                        <View className="flex-row items-start gap-2">
                          <Text className="flex-1 font-medium">{g.assignment?.title || '—'}</Text>
                          <View className="items-end">
                            <Text className={cn('font-semibold', gradeTone(pct).text)}>{score}</Text>
                            {pct !== null ? <Text className="text-muted-foreground text-xs">{`(${pct}%)`}</Text> : null}
                          </View>
                        </View>
                        {g.comment ? (
                          <Text className="text-muted-foreground text-xs" numberOfLines={2}>
                            {g.comment}
                          </Text>
                        ) : null}
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="text-muted-foreground text-xs">{`${k('type')}: ${g.assignment?.assignment_type?.title || '—'}`}</Text>
                          <Text className="text-muted-foreground text-xs">{`${k('due')}: ${g.assignment?.due_date ? monthDay(g.assignment.due_date) : '—'}`}</Text>
                          {status ? (
                            <View className={cn('rounded-full px-2 py-0.5', status[0])}>
                              <Text className={cn('text-xs', status[1])}>{status[2]}</Text>
                            </View>
                          ) : (
                            <Text className="text-xs text-green-600" accessibilityLabel={k('ok')}>
                              ✓
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </CardContent>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <Card className="min-w-[45%] flex-1 py-3">
      <CardContent className="items-center px-2">
        <Text className={cn('text-2xl font-bold', tone)}>{String(value)}</Text>
        <Text className="text-muted-foreground mt-1 text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}
