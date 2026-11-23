import { Stack } from 'expo-router';
import { Building2, TrendingUp, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';
import { ScrollView } from '@/components/app/keyboard';

import { StatTile, StatTiles } from '@/components/app/layout';
import { Panel, PanelTitle } from '@/components/app/panel';
import { ErrorState, LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { CompletionBars } from '@/features/admin/hifzi';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Ministerial Decree 1205: syllabus completion across every campus the inspector holds a Hifzi compliance grant for (web: /inspector/hifzi-compliance). */
export default function InspectorHifziCompliance() {
  const { t } = useTranslation();
  const h = (key: string) => t(`hifzi.compliance.${key}`);
  // No academic year is passed: the server measures each assigned campus against its own current year.
  const res = useApi(['inspector', 'hifzi-compliance'], () => inspector.hifziCompliance());
  const s = res.data;
  return (
    <>
      <Stack.Screen options={{ title: h('inspectorTitle') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text variant="muted" className="text-sm">
          {h('inspectorSubtitle')}
        </Text>
        {res.isLoading ? (
          <LoadingList rows={3} />
        ) : res.error || !s ? (
          <ErrorState message={res.error?.message || h('loadError')} onRetry={() => res.mutate()} />
        ) : (
          <>
            <StatTiles>
              <StatTile icon={Users} label={h('studentsTracked')} value={String(s.studentsTracked)} />
              <StatTile icon={TrendingUp} tone="success" label={h('avgCompletion')} value={s.avgCompletionPercent !== null ? `${s.avgCompletionPercent.toFixed(1)}%` : '—'} />
              <StatTile icon={Building2} tone="warning" label={h('schoolsCovered')} value={String(s.heatmap.length)} />
            </StatTiles>
            <Panel className="pb-4">
              <PanelTitle title={h('completionBySchool')} />
              <View className="px-4 pt-2">
                <CompletionBars rows={s.heatmap} emptyLabel={h('noData')} />
              </View>
            </Panel>
          </>
        )}
      </ScrollView>
    </>
  );
}
