import { Stack } from 'expo-router';
import { AlertTriangle, Award, BookOpen, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => grades.mutate()} />}>
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
            <Section title={k('summary')}>
              <StatTiles>
                <StatTile icon={BookOpen} label={k('tracked')} value={`${graded.length} / ${list.length}`} />
                <StatTile icon={TrendingUp} tone="success" label={k('above80')} value={String(graded.filter((g) => (g.average || 0) >= 80).length)} />
                <StatTile icon={AlertTriangle} tone="destructive" label={k('below70')} value={String(graded.filter((g) => (g.average || 0) < 70).length)} />
              </StatTiles>
            </Section>
          </>
        ) : null}
        <Section title={k('by_subject')}>
          {list.length === 0 ? (
            <EmptyState icon={BookOpen} title={k('empty')} />
          ) : (
            <Panel>
              {list.map((g, i) => {
                const tone = gradeTone(g.average);
                return (
                  <View key={g.course_period_id} className={cn('flex-row items-center gap-3 px-4 py-3', i < list.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <IconTile icon={BookOpen} size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold" numberOfLines={1}>
                        {g.subject?.name || t('app.st_unknown')}
                      </Text>
                      <View className="flex-row items-center gap-1.5">
                        {g.subject?.code ? <StatusChip label={g.subject.code} tone="muted" className="px-2 py-0.5" /> : null}
                        <Text className="text-muted-foreground text-xs">{k('graded', { count: g.graded_count })}</Text>
                      </View>
                      {g.average !== null ? <Bar value={g.average} tone={tone.bar} className="mt-1.5" /> : null}
                    </View>
                    <View className="flex-row items-center gap-2">
                      {g.letter_grade ? <Text className={cn('text-lg font-bold', tone.text)}>{g.letter_grade}</Text> : null}
                      <Text className={cn('text-xl font-bold', tone.text)}>{g.average !== null ? `${g.average}%` : '—'}</Text>
                    </View>
                  </View>
                );
              })}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
