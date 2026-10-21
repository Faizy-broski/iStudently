import { Stack } from 'expo-router';
import { Award, TrendingUp, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const SCALE = [
  { label: 'A (93–100%)', min: 93, gpa: '4.0' },
  { label: 'A- (90–92%)', min: 90, gpa: '3.7' },
  { label: 'B+ (87–89%)', min: 87, gpa: '3.3' },
  { label: 'B (83–86%)', min: 83, gpa: '3.0' },
  { label: 'B- (80–82%)', min: 80, gpa: '2.7' },
  { label: 'C+ (77–79%)', min: 77, gpa: '2.3' },
  { label: 'C (73–76%)', min: 73, gpa: '2.0' },
  { label: 'D (60–69%)', min: 60, gpa: '1.0' },
  { label: 'F (< 60%)', min: 0, gpa: '0.0' },
];

/** Cumulative GPA, class rank and overall percentage with the grade scale (web: /student/grades/gpa-rank-list). */
export default function StudentGpaRank() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.st_gpa_${key}`, o);
  const data = useApi(['student', 'gpa-rank'], () => student.getStudentGpaRank());

  if (data.isLoading) return <LoadingList rows={4} />;
  if (data.error) return <PortalError title={k('error')} message={data.error.message} />;
  const g = data.data;
  const noData = !g || g.gpa === null;
  const pct = g?.percentage ?? 0;

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        {noData ? (
          <EmptyState icon={TrendingUp} title={k('empty')} />
        ) : (
          <>
            <HeroCard className="items-center">
              <View className="size-12 items-center justify-center rounded-full bg-white/15">
                <Icon as={Award} className="size-6 text-white" />
              </View>
              <Text className="text-sm font-semibold text-white/85">{k('cumulative')}</Text>
              <Text className="text-6xl font-bold text-white">{g?.gpa?.toFixed(2)}</Text>
              <Text className="text-xs text-white/80">{k('out_of')}</Text>
              {g?.grade ? (
                <View className="rounded-full bg-white/15 px-4 py-1">
                  <Text className="text-base font-bold text-white">{g.grade}</Text>
                </View>
              ) : null}
            </HeroCard>
            <StatTiles>
              <StatTile icon={Users} label={k('rank')} value={g?.rank ? `#${g.rank}` : k('na')} note={g?.rank ? k('of', { count: g.total_students ?? 0 }) : undefined} />
              <StatTile icon={TrendingUp} tone="success" label={k('overall')} value={`${g?.percentage ?? 0}%`} />
            </StatTiles>
          </>
        )}
        {!noData && g?.percentage != null ? (
          <Section title={k('scale')}>
            <Panel className="gap-1 p-2">
              {SCALE.map((row) => {
                const on = pct >= row.min && (row.min === 0 || pct < row.min + 10);
                return (
                  <View key={row.label} className={cn('flex-row items-center justify-between rounded-xl px-3 py-2', on && 'bg-info-soft')}>
                    <Text className={cn('text-sm', on && 'text-brand dark:text-brand-secondary font-semibold')}>{row.label}</Text>
                    <Text className="text-muted-foreground text-sm">{k('row', { gpa: row.gpa })}</Text>
                  </View>
                );
              })}
            </Panel>
          </Section>
        ) : null}
      </ScrollView>
    </>
  );
}
