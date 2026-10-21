import { Stack } from 'expo-router';
import { Award, Percent, TrendingUp, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, Section, StatTile, StatTiles } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

const SCALE = [
  ['93–100', 'A', '4.0'],
  ['90–92', 'A-', '3.7'],
  ['87–89', 'B+', '3.3'],
  ['83–86', 'B', '3.0'],
  ['80–82', 'B-', '2.7'],
  ['77–79', 'C+', '2.3'],
  ['73–76', 'C', '2.0'],
  ['70–72', 'C-', '1.7'],
  ['60–69', 'D', '1.0'],
  ['< 60', 'F', '0.0'],
];

/** The selected child's GPA, class rank, class size and percentage, with the GPA scale (web: /parent/grades/gpa-rank-list). */
export default function ParentGpaRank() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.pa_gpa_${key}`);
  const { childId } = useChild();
  const data = useApi(childId ? ['parent', 'gpa-rank', childId] : null, ([, , id]) => parent.getGpaRank(id as string));

  if (!childId) return <NoChild />;
  if (data.isLoading) return <LoadingList rows={5} />;
  if (data.error) return <PortalError title={t('app.st_gpa_error')} message={data.error.message} />;
  const g = data.data;

  return (
    <>
      <Stack.Screen options={{ title: t('app.st_gpa_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        {!g || g.gpa === null ? (
          <>
            <Text variant="muted">{k('subtitle')}</Text>
            <EmptyState icon={TrendingUp} title={k('empty')} />
          </>
        ) : (
          <>
            <HeroCard>
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-semibold text-white/85">{k('gpa')}</Text>
                  <Text className="text-4xl font-bold text-white">{g.gpa.toFixed(2)}</Text>
                </View>
                <View className="size-14 items-center justify-center rounded-full bg-white/15">
                  <Icon as={Award} className="size-7 text-white" />
                </View>
              </View>
              {g.grade ? (
                <View className="flex-row">
                  <View className="rounded-full bg-white/15 px-3 py-1">
                    <Text className="text-xs font-semibold text-white">{g.grade}</Text>
                  </View>
                </View>
              ) : null}
              <Text className="text-xs text-white/80">{k('subtitle')}</Text>
            </HeroCard>
            <StatTiles>
              <StatTile icon={TrendingUp} label={t('app.st_gpa_rank')} value={g.rank !== null ? `#${g.rank}` : '—'} />
              <StatTile icon={Users} tone="muted" label={k('class_size')} value={g.total_students != null ? String(g.total_students) : '—'} />
              <StatTile icon={Percent} tone="success" label={k('percentile')} value={g.percentage !== null ? `${g.percentage.toFixed(1)}%` : '—'} />
            </StatTiles>
          </>
        )}
        <Section title={k('scale')}>
          <Panel>
            <View className="border-info-soft dark:border-border flex-row border-b px-4 py-2.5">
              <Text className="text-muted-foreground flex-1 text-xs font-semibold">{k('col_pct')}</Text>
              <Text className="text-muted-foreground w-20 text-center text-xs font-semibold">{k('col_letter')}</Text>
              <Text className="text-muted-foreground w-20 text-center text-xs font-semibold">{k('col_gpa')}</Text>
            </View>
            {SCALE.map(([range, letter, gpa], i) => (
              <View key={letter} className={cn('flex-row items-center px-4 py-2.5', i < SCALE.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <Text className="flex-1 text-sm">{range}</Text>
                <View className="w-20 items-center">
                  <StatusChip label={letter} tone="info" />
                </View>
                <Text className="w-20 text-center text-sm font-medium">{gpa}</Text>
              </View>
            ))}
          </Panel>
        </Section>
      </ScrollView>
    </>
  );
}
