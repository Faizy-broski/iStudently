import { Stack } from 'expo-router';
import { AlertTriangle, Award, BookOpen, FileText, MessageSquare, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
  return u.startsWith('A') ? 'text-success' : u.startsWith('B') ? 'text-brand dark:text-brand-secondary' : u.startsWith('C') ? 'text-warning' : 'text-destructive';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {overall !== null ? (
          <>
            <HeroCard className="items-center">
              <View className="size-14 items-center justify-center rounded-full bg-white/15">
                <Icon as={Award} className="size-7 text-white" />
              </View>
              <Text className="text-sm font-semibold text-white/85">{k('overall')}</Text>
              <Text className="text-5xl font-bold text-white">{`${overall}%`}</Text>
            </HeroCard>
            <Section title={k('overview')}>
              <StatTiles>
                <StatTile icon={BookOpen} label={k('graded')} value={`${graded.length} / ${subjects.length}`} />
                <StatTile icon={TrendingUp} tone="success" label={k('above80')} value={String(graded.filter((s) => (s.average || 0) >= 80).length)} />
                <StatTile icon={AlertTriangle} tone="destructive" label={k('below70')} value={String(graded.filter((s) => (s.average || 0) < 70).length)} />
              </StatTiles>
            </Section>
          </>
        ) : null}
        <Section title={k('subjects')}>
          {subjects.length === 0 ? (
            <EmptyState icon={FileText} title={k('empty')} body={k('empty_body')} />
          ) : (
            <Panel>
              {subjects.map((s, i) => {
                const tone = gradeTone(s.average);
                return (
                  <View key={s.course_period_id} className={cn('flex-row items-center gap-3 px-4 py-3', i < subjects.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <IconTile icon={BookOpen} size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {s.subject?.name || k('unknown')}
                      </Text>
                      <View className="flex-row flex-wrap items-center gap-1.5">
                        {s.subject?.code ? <StatusChip label={s.subject.code} tone="muted" className="px-2 py-0.5" /> : null}
                        <Text className="text-muted-foreground text-xs">{k('count', { count: s.grade_count })}</Text>
                      </View>
                      {s.average !== null ? <Bar value={s.average} tone={tone.bar} className="mt-1.5" /> : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {s.letter_grade ? <Text className={cn('text-lg font-bold', letterTone(s.letter_grade))}>{s.letter_grade}</Text> : null}
                      <Text className={cn('text-xl font-bold', tone.text)}>{s.average !== null ? `${s.average}%` : '—'}</Text>
                    </View>
                  </View>
                );
              })}
            </Panel>
          )}
        </Section>
        {comments.length ? (
          <Section title={k('comments')}>
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
        <InfoBanner>{k('note')}</InfoBanner>
      </ScrollView>
    </>
  );
}
