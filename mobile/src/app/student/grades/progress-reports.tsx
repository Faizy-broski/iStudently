import { Stack } from 'expo-router';
import { BookOpen, MessageSquare } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { IconTile, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {overall !== null ? (
          <Panel className="flex-row items-center gap-5 p-4">
            <View className="items-center">
              <Text className={cn('text-5xl font-bold', gradeTone(overall).text)}>{`${overall}%`}</Text>
              <Text className="text-muted-foreground mt-1 text-xs">{k('overall')}</Text>
            </View>
            <View className="flex-1 gap-2">
              <Row label={k('status')} value={trend(overall)} tone={cn('font-semibold', gradeTone(overall).text)} />
              <Row label={k('above80')} value={String(graded.filter((s) => (s.average || 0) >= 80).length)} />
              <Row label={k('attention')} value={String(graded.filter((s) => (s.average || 0) < 70).length)} tone="text-destructive" />
            </View>
          </Panel>
        ) : null}
        <Section title={k('by_subject')}>
          {subjects.length === 0 ? (
            <EmptyState icon={BookOpen} title={k('empty')} />
          ) : (
            <Panel>
              {subjects.map((s, i) => {
                const tone = gradeTone(s.average);
                return (
                  <View key={s.course_period_id} className={cn('flex-row items-center gap-3 px-4 py-3', i < subjects.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <IconTile icon={BookOpen} size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {s.subject?.name || '—'}
                      </Text>
                      <Text className="text-muted-foreground text-xs">{k('line', { trend: trend(s.average), count: s.grade_count })}</Text>
                      {s.average !== null ? <Bar value={s.average} tone={tone.bar} className="mt-1.5" /> : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {s.letter_grade ? <Text className={cn('text-lg font-bold', tone.text)}>{s.letter_grade}</Text> : null}
                      <Text className={cn('text-xl font-bold', tone.text)}>{s.average !== null ? `${s.average}%` : '—'}</Text>
                    </View>
                  </View>
                );
              })}
            </Panel>
          )}
        </Section>
        {comments.length ? (
          <Section title={k('notes')}>
            <Panel>
              {comments.map((c, i) => (
                <View key={c.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < comments.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <IconTile icon={MessageSquare} tone="warning" size={36} round />
                  <View className="flex-1 gap-1.5">
                    {c.comment?.code ? <StatusChip label={c.comment.code} tone="info" className="self-start" /> : null}
                    <Text className="text-sm">{c.comment?.comment || '—'}</Text>
                  </View>
                </View>
              ))}
            </Panel>
          </Section>
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
