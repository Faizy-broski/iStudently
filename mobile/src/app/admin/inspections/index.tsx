import { Stack } from 'expo-router';
import { CalendarCheck, ClipboardCheck, MessageSquareWarning, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { colors } from '@/lib/colors';
import { BarChart } from '@/components/app/charts';
import { EmptyState, LoadingList } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatTile, StatTiles } from '@/components/app/layout';
import { Text } from '@/components/ui/text';
import { ScoreHeatmap } from '@/features/admin/inspections-ui';
import { useCampus } from '@/features/campus/campus';
import { adminInspections } from '@/lib/api';
import { useApi } from '@/lib/data';

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
          <EmptyState icon={ClipboardCheck} title={d('select_campus_prompt')} />
        ) : res.isLoading ? (
          <LoadingList rows={4} />
        ) : s ? (
          <>
            <StatTiles>
              <StatTile icon={CalendarCheck} label={d('stat_visits_scheduled')} value={String(s.visitsScheduled)} />
              <StatTile icon={ClipboardCheck} tone="success" label={d('stat_visits_completed')} value={String(s.visitsCompleted)} />
              <StatTile icon={TrendingUp} tone="warning" label={d('stat_avg_score')} value={String(s.avgOverallScore ?? '—')} />
              <StatTile icon={MessageSquareWarning} tone="destructive" label={d('stat_open_appeals')} value={String(s.openAppealsCount)} />
            </StatTiles>
            {s.avgScoreByCategory.length ? (
              <Card>
                <CardHeader>
                  <CardTitle>{d('chart_title')}</CardTitle>
                  <CardDescription>{d('chart_desc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart categories={s.avgScoreByCategory.map((c) => c.category)} series={[{ name: '', color: colors.brand, values: s.avgScoreByCategory.map((c) => c.avgScore) }]} />
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
