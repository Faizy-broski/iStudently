import type { PlatformSummary } from '@studently/api-client';
import { router } from 'expo-router';
import { Building2, CalendarClock, FileWarning, Sparkles, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSWRConfig } from 'swr';

import { BarChart, LineChart } from '@/components/app/charts';
import { ListRow } from '@/components/app/list-row';
import { StatCard } from '@/components/app/stat-card';
import { SchoolLogo } from '@/components/app/school-logo';
import { ErrorState } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import i18n from '@/i18n';
import { platform } from '@/lib/api';
import { useApi } from '@/lib/data';
import { daysUntil, formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

function DashboardSkeleton() {
  return (
    <View className="gap-3 p-4">
      <View className="flex-row gap-3">
        <Skeleton className="h-28 flex-1 rounded-xl" />
        <Skeleton className="h-28 flex-1 rounded-xl" />
      </View>
      <View className="flex-row gap-3">
        <Skeleton className="h-28 flex-1 rounded-xl" />
        <Skeleton className="h-28 flex-1 rounded-xl" />
      </View>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-56 rounded-xl" />
    </View>
  );
}

/**
 * Revenue in the platform currency from Settings (like the web). Invoices billed in another currency
 * are not converted (no exchange rates); they are listed underneath so no money is hidden.
 */
function Revenue({ data }: { data: PlatformSummary }) {
  const { t } = useTranslation();
  const settings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const currency = settings.data?.currency ?? data.revenue[0]?.currency ?? 'USD';
  const r = data.revenue.find((x) => x.currency === currency) ?? { currency, paid_this_month: 0, paid_last_month: 0, change_pct: null, paid_total: 0, outstanding: 0 };
  const others = data.revenue.filter((x) => x.currency !== currency && (x.paid_total > 0 || x.outstanding > 0 || x.paid_this_month > 0));
  const up = (r.change_pct ?? 0) >= 0;
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle>{t('app.sa_revenue')}</CardTitle>
      </CardHeader>
      <CardContent className="gap-3 px-4">
        <View className="gap-1">
          <Text variant="muted">{t('app.sa_paid_this_month')}</Text>
          <Text className="text-xl font-bold">{formatMoney(r.paid_this_month, r.currency)}</Text>
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {r.change_pct === null ? (
              <Text className="text-muted-foreground text-xs">{t('app.sa_no_change')}</Text>
            ) : (
              <View className="flex-row items-center gap-1">
                <Icon as={up ? TrendingUp : TrendingDown} className={cn('size-3.5', up ? 'text-success' : 'text-destructive')} />
                <Text className={cn('text-xs', up ? 'text-success' : 'text-destructive')}>
                  {t('app.sa_change', { pct: `${up ? '+' : ''}${formatNumber(r.change_pct)}` })}
                </Text>
              </View>
            )}
            <Text className="text-muted-foreground text-xs">{t('app.sa_outstanding', { amount: formatMoney(r.outstanding, r.currency) })}</Text>
          </View>
        </View>
        {others.length ? (
          <View className="border-border gap-1 border-t pt-3">
            <Text className="text-muted-foreground text-xs">{t('app.sa_other_currencies')}</Text>
            {others.map((o) => (
              <Text key={o.currency} className="text-muted-foreground text-xs">
                {t('app.sa_other_currency_line', { paid: formatMoney(o.paid_this_month, o.currency), outstanding: formatMoney(o.outstanding, o.currency) })}
              </Text>
            ))}
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Month label in the app language (the API sends English "Jan".."Dec", in order). */
function monthLabel(index: number) {
  return new Date(2000, index, 1).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'short' });
}

/** Web "School Growth" and "Revenue Overview" charts for the current year. */
function YearCharts() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const growth = useApi(['platform', 'dash-growth', year], ([, , y]) => platform.getSchoolGrowth(y as number));
  const revenue = useApi(['platform', 'dash-revenue', year], ([, , y]) => platform.getRevenue(y as number));
  const settings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const currency = settings.data?.currency ?? 'USD';
  const g = growth.data ?? [];
  const r = revenue.data ?? [];
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('app.sa_growth_title')}</CardTitle>
          <CardDescription>{t('app.sa_growth_desc', { year })}</CardDescription>
        </CardHeader>
        <CardContent>
          {g.length ? (
            <LineChart categories={g.map((_, i) => monthLabel(i))} series={[{ name: t('app.sa_schools'), values: g.map((m) => m.schools), color: '#022172' }]} area />
          ) : growth.isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <Text variant="muted">{growth.error?.message ?? t('app.sa_no_chart_data')}</Text>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('app.sa_revenue_chart_title')}</CardTitle>
          <CardDescription>{t('app.sa_revenue_chart_desc', { year, currency })}</CardDescription>
        </CardHeader>
        <CardContent>
          {r.length ? (
            <BarChart
              categories={r.map((_, i) => monthLabel(i))}
              series={[
                { name: t('app.sa_revenue_paid'), values: r.map((m) => m.revenue), color: '#10B981' },
                { name: t('app.sa_revenue_invoices'), values: r.map((m) => m.subscriptions), color: '#57A3CC' },
              ]}
            />
          ) : revenue.isLoading ? (
            <Skeleton className="h-56 rounded-xl" />
          ) : (
            <Text variant="muted">{revenue.error?.message ?? t('app.sa_no_chart_data')}</Text>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Web "Platform Statistics" card (GET /dashboard/stats). */
function PlatformStatsCard() {
  const { t } = useTranslation();
  const stats = useApi(['platform', 'dash-stats'], () => platform.getStats());
  const st = stats.data;
  if (!st) return null;
  const rows: [string, number, string][] = [
    [t('app.sa_ps_total_schools'), st.totalSchools, '#022172'],
    [t('app.sa_ps_active_schools'), st.activeSchools, '#14B8A6'],
    [t('app.sa_ps_total_billings'), st.totalBillings, '#F97316'],
    [t('app.sa_ps_paid'), st.paidBillings, '#10B981'],
    [t('app.sa_ps_suspended'), st.suspendedSchools, '#EF4444'],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('app.sa_ps_title')}</CardTitle>
        <CardDescription>{t('app.sa_ps_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="gap-3">
        {rows.map(([label, value, color]) => (
          <View key={label} className="flex-row items-center gap-3">
            <View className="size-3 rounded-full" style={{ backgroundColor: color }} />
            <Text className="text-muted-foreground flex-1 text-sm">{label}</Text>
            <Text className="font-semibold">{formatNumber(value)}</Text>
          </View>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SuperadminDashboard() {
  const { t } = useTranslation();
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'summary'], () => platform.getSummary());
  const { mutate: refreshDash } = useSWRConfig();

  if (isLoading && !data) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error.message} offline={error.offline} onRetry={() => mutate()} />;
  if (!data) return null;

  const s = data.schools;
  const inv = data.invoices;
  const refreshAll = () => {
    mutate();
    refreshDash((key) => Array.isArray(key) && key[0] === 'platform' && String(key[1]).startsWith('dash-'));
  };
  const openSchool = (id: string) => router.push({ pathname: '/superadmin/school/[id]', params: { id } });

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-3 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={isValidating && !isLoading} onRefresh={() => refreshAll()} />}>
      <View className="flex-row gap-3">
        <StatCard
          icon={Building2}
          label={t('app.sa_schools')}
          value={formatNumber(s.total)}
          detail={t('app.sa_active_suspended', { active: formatNumber(s.active), suspended: formatNumber(s.suspended) })}
        />
        <StatCard
          icon={CalendarClock}
          label={t('app.sa_trials')}
          value={formatNumber(s.on_trial)}
          detail={t('app.sa_trials_ending', { count: s.trials_ending_7d })}
          tone={s.trials_ending_7d > 0 ? 'warning' : undefined}
        />
      </View>
      <View className="flex-row gap-3">
        <StatCard
          icon={Sparkles}
          label={t('app.sa_new_schools')}
          value={formatNumber(s.new_this_month)}
          detail={t('app.sa_vs_last_month', { count: formatNumber(s.new_last_month) })}
        />
        <StatCard
          icon={FileWarning}
          label={t('app.sa_invoices')}
          value={formatNumber(inv.total)}
          detail={t('app.sa_invoices_attention', { overdue: formatNumber(inv.overdue), unpaid: formatNumber(inv.unpaid) })}
          tone={inv.overdue > 0 ? 'destructive' : undefined}
        />
      </View>

      <Revenue data={data} />
      <YearCharts />

      {data.trials_ending.length > 0 ? (
        <Card className="gap-0 py-0">
          <CardHeader className="px-4 py-4">
            <CardTitle>{t('app.sa_trials_ending_title')}</CardTitle>
          </CardHeader>
          {data.trials_ending.map((sch, i) => (
            <View key={sch.id}>
              {i > 0 ? <Separator /> : null}
              <ListRow
                title={sch.name}
                subtitle={sch.trial_ends_at ? t('app.sa_ends_in', { days: Math.max(0, daysUntil(sch.trial_ends_at)) }) : undefined}
                leading={<SchoolLogo url={sch.logo_url} size={36} />}
                onPress={() => openSchool(sch.id)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-4">
          <CardTitle>{t('app.sa_recent_schools')}</CardTitle>
        </CardHeader>
        {data.recent_schools.map((sch, i) => (
          <View key={sch.id}>
            {i > 0 ? <Separator /> : null}
            <ListRow
              title={sch.name}
              leading={<SchoolLogo url={sch.logo_url} size={36} />}
              trailing={
                <Badge variant={sch.status === 'suspended' ? 'destructive' : sch.is_trial ? 'secondary' : 'default'}>
                  <Text>
                    {sch.status === 'suspended' ? t('app.sa_status_suspended') : sch.is_trial ? t('app.sa_status_trial') : t('app.sa_status_active')}
                  </Text>
                </Badge>
              }
              onPress={() => openSchool(sch.id)}
            />
          </View>
        ))}
      </Card>
      <PlatformStatsCard />
    </ScrollView>
  );
}
