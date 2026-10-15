import { Stack } from 'expo-router';
import { CalendarCheck, ClipboardCheck, MessageSquareWarning, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart } from '@/components/app/charts';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ScoreHeatmap } from '@/features/admin/inspections-ui';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

function Stat({ icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <View className="border-border bg-card rounded-xl border p-4" style={{ width: '47.5%' }}>
      <View className="mb-1 flex-row items-center gap-1.5">
        <Icon as={icon} className="text-muted-foreground size-3.5" />
        <Text className="text-muted-foreground flex-1 text-xs">{label}</Text>
      </View>
      <Text className="text-2xl font-bold">{value}</Text>
    </View>
  );
}

/** Inspection dashboard for the selected campus (web: /admin/inspections/dashboard). */
export default function InspectionDashboard() {
  const { t } = useTranslation();
  const d = (k: string) => t(`inspections.dashboard.${k}`);
  const { scopeId } = useCampus();
  const res = useApi(scopeId ? ['admin', 'inspection-dashboard', scopeId] : null, ([, , id]) => adminInspections.dashboard(id as string));
  const s = res.data;
  return (
    <>
      <Stack.Screen options={{ title: d('admin_page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10">
        <Text variant="muted" className="text-sm">{d('admin_page_subtitle')}</Text>
        {!scopeId ? (
          <Text variant="muted" className="py-10 text-center text-sm">{d('select_campus_prompt')}</Text>
        ) : res.isLoading ? (
          <LoadingList rows={4} />
        ) : s ? (
          <>
            <View className="flex-row flex-wrap gap-3">
              <Stat icon={CalendarCheck} label={d('stat_visits_scheduled')} value={s.visitsScheduled} />
              <Stat icon={ClipboardCheck} label={d('stat_visits_completed')} value={s.visitsCompleted} />
              <Stat icon={TrendingUp} label={d('stat_avg_score')} value={s.avgOverallScore ?? '—'} />
              <Stat icon={MessageSquareWarning} label={d('stat_open_appeals')} value={s.openAppealsCount} />
            </View>
            {s.avgScoreByCategory.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>{d('chart_title')}</CardTitle>
                  <CardDescription>{d('chart_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart categories={s.avgScoreByCategory.map((c) => c.category)} series={[{ name: '', color: '#022172', values: s.avgScoreByCategory.map((c) => c.avgScore) }]} />
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>{d('heatmap_title')}</CardTitle>
                <CardDescription>{d('heatmap_desc_admin')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreHeatmap rows={s.heatmap} emptyLabel={d('heatmap_empty')} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </>
  );
}
