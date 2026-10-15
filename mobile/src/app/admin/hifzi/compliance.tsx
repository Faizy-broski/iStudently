import { Stack } from 'expo-router';
import { TrendingUp, Users } from 'lucide-react-native';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
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
          <Text className="text-muted-foreground py-8 text-center text-sm">{h('noAcademicYear')}</Text>
        ) : stats.error || !s ? (
          <ErrorState message={stats.error?.message || h('loadError')} onRetry={() => stats.mutate()} />
        ) : (
          <>
            <View className="flex-row gap-3">
              <Card className="flex-1">
                <CardContent className="gap-1 pt-4">
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={Users} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-xs">{h('studentsTracked')}</Text>
                  </View>
                  <Text className="text-2xl font-bold">{s.studentsTracked}</Text>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="gap-1 pt-4">
                  <View className="flex-row items-center gap-1.5">
                    <Icon as={TrendingUp} className="text-muted-foreground size-4" />
                    <Text className="text-muted-foreground text-xs">{h('avgCompletion')}</Text>
                  </View>
                  <Text className="text-2xl font-bold">{s.avgCompletionPercent !== null ? `${s.avgCompletionPercent.toFixed(1)}%` : '—'}</Text>
                </CardContent>
              </Card>
            </View>
            <Card>
              <CardContent className="gap-3 pt-4">
                <Text className="font-semibold">{h('completionByCircle')}</Text>
                <CompletionBars rows={s.heatmap} emptyLabel={h('noData')} />
              </CardContent>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
