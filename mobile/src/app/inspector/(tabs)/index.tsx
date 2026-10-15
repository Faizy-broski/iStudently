import { AlertTriangle, Building2, CalendarCheck, ClipboardCheck, MessageSquareWarning, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { BarChart } from '@/components/app/charts';
import { LoadingList } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ScoreHeatmap } from '@/features/admin/inspections-ui';
import { useSession } from '@/features/auth/session';
import { inspector } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Inspector home: visit / score / appeal figures, average score by rubric category, the score heatmap, assigned campuses (web: /inspector/dashboard). */
export default function InspectorDashboard() {
  const { t } = useTranslation();
  const d = (key: string) => t(`inspections.dashboard.${key}`);
  const { me } = useSession();
  const first = me.status === 'ready' ? me.me.profile.first_name || t('app.role_inspector') : '';
  const stats = useApi(['inspector', 'dashboard'], () => inspector.dashboard());
  const schools = useApi(['inspector', 'schools'], () => inspector.mySchools());
  const s = stats.data;
  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([stats.mutate(), schools.mutate()])} />}>
      <View>
        <Text className="text-xl font-bold">{t('app.in_welcome', { name: first })}</Text>
        <Text className="text-muted-foreground text-sm">{t('app.in_dashboard_subtitle')}</Text>
      </View>
      {stats.isLoading ? (
        <LoadingList rows={3} />
      ) : s ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Stat icon={CalendarCheck} label={d('stat_visits_scheduled')} value={s.visitsScheduled} />
            <Stat icon={ClipboardCheck} label={d('stat_visits_completed')} value={s.visitsCompleted} />
            <Stat icon={TrendingUp} label={d('stat_avg_score')} value={s.avgOverallScore ?? '—'} />
            <Stat icon={MessageSquareWarning} label={d('stat_open_appeals')} value={s.openAppealsCount} />
          </View>
          {s.avgScoreByCategory.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{d('chart_title')}</CardTitle>
                <CardDescription>{d('chart_desc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart categories={s.avgScoreByCategory.map((c) => c.category)} series={[{ name: '', color: '#022172', values: s.avgScoreByCategory.map((c) => c.avgScore) }]} />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{d('heatmap_title')}</CardTitle>
              <CardDescription>{d('heatmap_desc_inspector')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScoreHeatmap rows={s.heatmap} emptyLabel={d('heatmap_empty')} />
            </CardContent>
          </Card>
        </>
      ) : null}
      <Card>
        <CardHeader>
          <View className="flex-row items-center gap-2">
            <Icon as={Building2} className="size-5 text-[#022172] dark:text-blue-300" />
            <CardTitle className="text-base">{t('app.in_assigned_campuses')}</CardTitle>
          </View>
          <CardDescription>{t('app.in_assigned_campuses_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {schools.isLoading ? (
            <Text className="text-muted-foreground text-sm">{t('app.in_loading_campuses')}</Text>
          ) : schools.error ? (
            <View className="flex-row items-center gap-2">
              <Icon as={AlertTriangle} className="size-4 text-red-600" />
              <Text className="text-sm text-red-600">{schools.error.message}</Text>
            </View>
          ) : !(schools.data ?? []).length ? (
            <Text className="text-muted-foreground py-4 text-sm">{t('app.in_no_campuses')}</Text>
          ) : (
            (schools.data ?? []).map((sc, i) => (
              <View key={sc.id} className={i > 0 ? 'border-border flex-row items-center gap-3 border-t py-3' : 'flex-row items-center gap-3 py-3'}>
                <Icon as={Building2} className="text-muted-foreground size-4" />
                <Text className="text-sm font-medium">{sc.name}</Text>
              </View>
            ))
          )}
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function Stat({ icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="gap-1 p-4">
        <View className="flex-row items-center gap-1.5">
          <Icon as={icon} className="text-muted-foreground size-3.5" />
          <Text className="text-muted-foreground flex-1 text-xs">{label}</Text>
        </View>
        <Text className="text-2xl font-bold">{String(value)}</Text>
      </CardContent>
    </Card>
  );
}
