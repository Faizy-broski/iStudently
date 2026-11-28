import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useSupervisorOverview } from '@/features/fina-supervisor/data';
import { cn } from '@/lib/utils';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="w-[48%]">
      <CardContent className="gap-1 pt-4">
        <Text className="text-muted-foreground text-xs">{label}</Text>
        <Text className="text-2xl font-bold">{value}</Text>
      </CardContent>
    </Card>
  );
}

/** Municipal oversight: aggregate numbers per school, never content (web: /fina-supervisor/dashboard). */
export default function FinaSupervisorDashboard() {
  const { t } = useTranslation();
  const f = (k: string) => t(`fina.supervisor.${k}`);
  const res = useSupervisorOverview();
  const data = res.data ?? null;
  return (
    <View className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => res.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{f('dashboard_subtitle')}</Text>
        {res.isLoading ? (
          <LoadingList rows={4} />
        ) : !data ? (
          <ErrorState message={res.error?.message} onRetry={() => res.mutate()} />
        ) : (
          <>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              <Stat label={f('stat_schools_active')} value={data.schoolsActive} />
              <Stat label={f('stat_schools_total')} value={data.schoolsTotal} />
              <Stat label={f('stat_posts_this_month')} value={data.postsThisMonth} />
              <Stat label={f('stat_consent_coverage')} value={`${data.consentCoverage}%`} />
              <Stat label={f('stat_open_alerts')} value={data.openAlerts} />
            </View>
            <Text className="pt-2 font-semibold">{f('schools_table_title')}</Text>
            {!data.schools.length ? (
              <EmptyState title={f('empty')} />
            ) : (
              <Card>
                <CardContent className="py-1">
                  {data.schools.map((school, i) => (
                    <View key={school.id}>
                      {i > 0 ? <Separator /> : null}
                      <View className="gap-1 py-3">
                        <View className="flex-row items-center justify-between gap-2">
                          <Text className="flex-1 text-sm font-semibold">{school.name}</Text>
                          <Text className={cn('text-xs font-medium', school.isActive ? 'text-success' : 'text-muted-foreground')}>
                            {f(school.isActive ? 'status_active' : 'status_inactive')}
                          </Text>
                        </View>
                        <Text className="text-muted-foreground text-xs">
                          {f('col_consent_coverage')}: {school.consentCoverage}% · {f('col_blocked_this_week')}: {school.blockedThisWeek}
                        </Text>
                        {school.alert ? <Text className="text-destructive text-xs font-medium">{f(`alert_${school.alert}`)}</Text> : null}
                      </View>
                    </View>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
