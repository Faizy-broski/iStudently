import { Stack } from 'expo-router';
import { TrendingUp, Users } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';

import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { StatTile, StatTiles } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { CompletionBars, useHz } from '@/features/admin/hifzi';
import { useCampus } from '@/features/campus/campus';
import { adminAcademics, adminHifzi } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Ministerial Decree 1205: syllabus completion for the selected campus, per circle (web: /admin/hifzi/compliance). */
export default function HifziCompliance() {
  const { h } = useHz('compliance');
  const { campusId, scopeId } = useCampus();
  const year = useApi(['admin', 'academic-year-current'], () => adminAcademics.currentAcademicYear());
  const yearId = year.data?.id ?? null;
  const stats = useApi(yearId && scopeId ? ['admin', 'hifzi-compliance', scopeId, yearId, campusId ?? 'school'] : null, ([, , s, y]) => adminHifzi.compliance(s as string, y as string, campusId));
  const s = stats.data;
  return (
    <View className="bg-background flex-1">
      <Stack.Screen options={{ title: h('title') }} />
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => stats.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{h('subtitle')}</Text>
        {year.isLoading || stats.isLoading ? (
          <LoadingList rows={3} />
        ) : !yearId ? (
          <EmptyState title={h('noAcademicYear')} />
        ) : stats.error || !s ? (
          <ErrorState message={stats.error?.message || h('loadError')} onRetry={() => stats.mutate()} />
        ) : (
          <>
            <StatTiles>
              <StatTile icon={Users} label={h('studentsTracked')} value={String(s.studentsTracked)} />
              <StatTile icon={TrendingUp} tone="success" label={h('avgCompletion')} value={s.avgCompletionPercent !== null ? `${s.avgCompletionPercent.toFixed(1)}%` : '—'} />
            </StatTiles>
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="text-base font-semibold">{h('completionByCircle')}</Text>
                <CompletionBars rows={s.heatmap} emptyLabel={h('noData')} />
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
