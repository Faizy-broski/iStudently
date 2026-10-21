import type { BillingRecord, FeedbackReport, PlatformSummary } from '@studently/api-client';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Bell, Building2, Bug, CalendarClock, CreditCard, FileWarning, Lightbulb, Plus, Search, Settings, ShieldAlert, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useSWRConfig } from 'swr';

import { BrandGradient } from '@/components/app/brand-gradient';
import { BarChart, LineChart } from '@/components/app/charts';
import { SchoolLogo } from '@/components/app/school-logo';
import { ErrorState } from '@/components/app/states';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import i18n from '@/i18n';
import { platform } from '@/lib/api';
import { chartPalette, colors, useColors } from '@/lib/colors';
import { useApi } from '@/lib/data';
import { daysUntil, formatDate, formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

// Super admin dashboard (Figma "Studently Console" look) with the platform's real data.

function DashboardSkeleton() {
  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <View className="gap-3 p-4">
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-48 rounded-3xl" />
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1 rounded-2xl" />
          <Skeleton className="h-24 flex-1 rounded-2xl" />
        </View>
        <View className="flex-row gap-3">
          <Skeleton className="h-24 flex-1 rounded-2xl" />
          <Skeleton className="h-24 flex-1 rounded-2xl" />
        </View>
        <Skeleton className="h-40 rounded-2xl" />
      </View>
    </SafeAreaView>
  );
}

const go = (href: string) => router.push(href as Href);

/** Section title with an optional "View all" link. */
function Section({ title, onViewAll, children }: { title: string; onViewAll?: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold">{title}</Text>
        {onViewAll ? (
          <Pressable onPress={onViewAll} hitSlop={8}>
            <Text className="text-brand-secondary text-sm font-medium">{t('app.sad_view_all')}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <View className={cn('border-border bg-card rounded-2xl border', className)}>{children}</View>;
}

/** Small coloured status chip. */
function Chip({ label, tone }: { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'muted' }) {
  const cls = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    destructive: 'bg-destructive-soft text-destructive',
    info: 'bg-info-soft text-brand-secondary',
    muted: 'bg-muted text-muted-foreground',
  }[tone].split(' ');
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', cls[0])}>
      <Text className={cn('text-[11px] font-semibold', cls[1])}>{label}</Text>
    </View>
  );
}

function Header({ openFeedback }: { openFeedback: number }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-3">
      <Image source={require('@/assets/images/icon.png')} style={{ width: 40, height: 40, borderRadius: 12 }} accessibilityIgnoresInvertColors />
      <View className="flex-1">
        <Text className="text-lg font-bold">{t('app.sad_console')}</Text>
        <Text variant="muted" className="text-xs">
          {t('app.sad_console_sub')}
        </Text>
      </View>
      <Pressable onPress={() => go('/superadmin/schools')} className="border-border bg-card size-10 items-center justify-center rounded-full border" accessibilityRole="button" accessibilityLabel={t('app.sad_search')}>
        <Icon as={Search} className="size-4" />
      </Pressable>
      <Pressable onPress={() => go('/superadmin/inbox')} className="border-border bg-card size-10 items-center justify-center rounded-full border" accessibilityRole="button" accessibilityLabel={t('app.sa_tab_inbox')}>
        <Icon as={Bell} className="size-4" />
        {openFeedback > 0 ? <View className="bg-destructive absolute end-2.5 top-2 size-2 rounded-full" /> : null}
      </Pressable>
    </View>
  );
}

/** White line of the monthly paid amounts (Jan..current month). */
function Sparkline({ values, width = 300, height = 64 }: { values: number[]; width?: number; height?: number }) {
  const c = useColors();
  if (values.length < 2) return <View style={{ height }} />;
  const max = Math.max(1, ...values);
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 6 - (v / max) * (height - 12)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Path d={d} stroke={c.white} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Hero({ data, currency, monthly, overdue }: { data: PlatformSummary; currency: string; monthly: number[]; overdue: number }) {
  const { t } = useTranslation();
  const r = data.revenue.find((x) => x.currency === currency) ?? { paid_this_month: 0, change_pct: null, outstanding: 0, paid_total: 0 };
  const up = (r.change_pct ?? 0) >= 0;
  const yearPaid = monthly.reduce((a, b) => a + b, 0);
  return (
    <BrandGradient variant="primary" angle={150} style={{ borderRadius: 24 }}>
      <View className="gap-1 p-5">
        <View className="flex-row items-start justify-between">
          <Text className="text-white text-xs opacity-80">{t('app.sad_paid_month')}</Text>
          {r.change_pct !== null ? (
            <View className="bg-overlay-light rounded-full px-2 py-0.5">
              <Text className="text-white text-[11px] font-semibold">{`${up ? '+' : ''}${formatNumber(r.change_pct)}%`}</Text>
            </View>
          ) : null}
        </View>
        <Text className="text-white text-3xl font-bold">{formatMoney(r.paid_this_month, currency)}</Text>
        <View className="mt-2">
          <Sparkline values={monthly} />
        </View>
        <View className="mt-3 flex-row">
          {[
            [t('app.sad_outstanding'), formatMoney(r.outstanding, currency)],
            [t('app.sad_paid_year'), formatMoney(yearPaid, currency)],
            [t('app.sad_overdue'), formatNumber(overdue)],
          ].map(([label, value]) => (
            <View key={label} className="flex-1 gap-0.5">
              <Text className="text-white text-[11px] opacity-70">{label}</Text>
              <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </BrandGradient>
  );
}

function StatTile({ label, value, chip, note, onPress }: { label: string; value: string; chip?: React.ReactNode; note?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} className="border-border bg-card flex-1 gap-1 rounded-2xl border p-4 active:opacity-80">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Text className="text-2xl font-bold">{value}</Text>
      {chip ?? (note ? <Text className="text-muted-foreground text-xs">{note}</Text> : null)}
    </Pressable>
  );
}

/** Stacked bar of current subscriptions per plan (latest invoice per school). */
function PlanMix({ records }: { records: BillingRecord[] }) {
  const latest = new Map<string, BillingRecord>();
  for (const r of records) {
    const prev = latest.get(r.school_id);
    if (!prev || r.start_date > prev.start_date) latest.set(r.school_id, r);
  }
  const counts = new Map<string, number>();
  for (const r of latest.values()) counts.set(r.subscription_plan || '—', (counts.get(r.subscription_plan || '—') ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((a, [, n]) => a + n, 0);
  const palette = chartPalette();
  if (!total) return null;
  return (
    <Panel className="gap-3 p-4">
      <View className="h-2.5 flex-row overflow-hidden rounded-full">
        {rows.map(([plan, n], i) => (
          <View key={plan} style={{ flex: n, backgroundColor: palette[i % palette.length] }} />
        ))}
      </View>
      <View className="flex-row flex-wrap gap-x-4 gap-y-1">
        {rows.map(([plan, n], i) => (
          <View key={plan} className="flex-row items-center gap-1.5">
            <View className="size-2 rounded-full" style={{ backgroundColor: palette[i % palette.length] }} />
            <Text className="text-xs">
              <Text className="text-xs font-semibold">{formatNumber(n)}</Text> {plan}
            </Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

type Attention = { key: string; id: string; name: string; logo?: string | null; detail: string; chip: string; tone: 'warning' | 'destructive' | 'muted'; icon: LucideIcon };

function AttentionRow({ a, last }: { a: Attention; last: boolean }) {
  const c = useColors();
  const tint = a.tone === 'destructive' ? 'bg-destructive-soft' : a.tone === 'warning' ? 'bg-warning-soft' : 'bg-muted';
  return (
    <Pressable onPress={() => router.push({ pathname: '/superadmin/school/[id]', params: { id: a.id } })} className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', !last && 'border-border border-b')}>
      {a.logo ? (
        <SchoolLogo url={a.logo} size={36} />
      ) : (
        <View className={cn('size-9 items-center justify-center rounded-xl', tint)}>
          <Icon as={a.icon} size={16} color={a.tone === 'destructive' ? c.destructive : a.tone === 'warning' ? c.warning : c.mutedForeground} />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {a.name}
        </Text>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {a.detail}
        </Text>
      </View>
      <Chip label={a.chip} tone={a.tone} />
    </Pressable>
  );
}

function FeedbackRow({ f, last }: { f: FeedbackReport; last: boolean }) {
  const { t } = useTranslation();
  const c = useColors();
  const bug = f.category === 'bug';
  return (
    <Pressable onPress={() => router.push({ pathname: '/superadmin/inbox/feedback/[id]', params: { id: f.id } })} className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', !last && 'border-border border-b')}>
      <View className={cn('size-9 items-center justify-center rounded-full', bug ? 'bg-destructive-soft' : 'bg-info-soft')}>
        <Icon as={bug ? Bug : Lightbulb} size={16} color={bug ? c.destructive : c.brandSecondary} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {f.title}
        </Text>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {[f.submitter_name, formatDate(f.created_at)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Chip label={bug ? t('app.ib_cat_bug') : t('app.sad_request')} tone={bug ? 'destructive' : 'muted'} />
    </Pressable>
  );
}

function QuickAction({ icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Pressable onPress={() => go(href)} className="border-border bg-card flex-1 items-center gap-2 rounded-2xl border py-3 active:opacity-80" accessibilityRole="button">
      <View className="bg-info-soft size-9 items-center justify-center rounded-xl">
        <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" />
      </View>
      <Text className="text-[11px] font-medium" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
            <LineChart categories={g.map((_, i) => monthLabel(i))} series={[{ name: t('app.sa_schools'), values: g.map((m) => m.schools), color: colors.brand }]} area />
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
                { name: t('app.sa_revenue_paid'), values: r.map((m) => m.revenue), color: colors.success },
                { name: t('app.sa_revenue_invoices'), values: r.map((m) => m.subscriptions), color: colors.brandSecondary },
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


export default function SuperadminDashboard() {
  const { t } = useTranslation();
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'summary'], () => platform.getSummary());
  const { mutate: refreshAll } = useSWRConfig();
  const year = new Date().getFullYear();
  const stats = useApi(['platform', 'dash-stats'], () => platform.getStats());
  const settings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const revenue = useApi(['platform', 'dash-revenue', year], ([, , y]) => platform.getRevenue(y as number));
  const schools = useApi(['platform', 'schools'], () => platform.listSchools());
  const records = useApi(['platform', 'dash-records'], () => platform.listRecords({ page: 1, limit: 100 }));
  const feedback = useApi(['platform', 'feedback', 'open', 'all'], () => platform.listFeedback({ status: 'open' }));

  if (isLoading && !data) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error.message} offline={error.offline} onRetry={() => mutate()} />;
  if (!data) return null;

  const s = data.schools;
  const inv = data.invoices;
  const currency = settings.data?.currency ?? data.revenue[0]?.currency ?? 'USD';
  const monthly = (revenue.data ?? []).slice(0, new Date().getMonth() + 1).map((m) => m.revenue);
  const allSchools = schools.data ?? [];
  const campuses = allSchools.filter((x) => x.parent_school_id).length;
  const recs = records.data ?? [];
  const openFeedback = feedback.data ?? [];

  const attention: Attention[] = [
    ...recs
      .filter((r) => r.effective_status === 'overdue')
      .slice(0, 3)
      .map((r) => ({
        key: `inv-${r.id}`,
        id: r.school_id,
        name: r.school_name ?? '—',
        detail: t('app.sad_overdue_days', { count: Math.max(0, -daysUntil(r.due_date)) }),
        chip: t('app.sad_past_due'),
        tone: 'destructive' as const,
        icon: FileWarning,
      })),
    ...data.trials_ending.slice(0, 2).map((x) => ({
      key: `trial-${x.id}`,
      id: x.id,
      name: x.name,
      logo: x.logo_url,
      detail: x.trial_ends_at ? t('app.sa_ends_in', { days: Math.max(0, daysUntil(x.trial_ends_at)) }) : '',
      chip: t('app.sa_status_trial'),
      tone: 'warning' as const,
      icon: CalendarClock,
    })),
    ...allSchools
      .filter((x) => x.status === 'suspended' && !x.parent_school_id)
      .slice(0, 2)
      .map((x) => ({ key: `sus-${x.id}`, id: x.id, name: x.name, logo: x.logo_url, detail: x.city ?? '', chip: t('app.sa_status_suspended'), tone: 'muted' as const, icon: ShieldAlert })),
  ];

  const onRefresh = () => {
    mutate();
    refreshAll((key) => Array.isArray(key) && key[0] === 'platform');
  };

  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView contentContainerClassName="gap-5 p-4 pb-8" refreshControl={<RefreshControl refreshing={isValidating && !isLoading} onRefresh={onRefresh} />}>
        <Header openFeedback={openFeedback.length} />
        <Hero data={data} currency={currency} monthly={monthly} overdue={inv.overdue} />

        <View className="gap-3">
          <View className="flex-row gap-3">
            <StatTile
              label={t('app.sa_schools')}
              value={formatNumber(s.total)}
              chip={s.new_this_month ? <Chip label={t('app.sad_new_month', { count: s.new_this_month })} tone="success" /> : undefined}
              note={t('app.sa_active_suspended', { active: formatNumber(s.active), suspended: formatNumber(s.suspended) })}
              onPress={() => go('/superadmin/schools')}
            />
            <StatTile label={t('app.sad_campuses')} value={formatNumber(campuses)} note={t('app.sad_campus_note')} onPress={() => go('/superadmin/schools')} />
          </View>
          <View className="flex-row gap-3">
            <StatTile
              label={t('app.sa_trials')}
              value={formatNumber(s.on_trial)}
              chip={s.trials_ending_7d ? <Chip label={t('app.sa_trials_ending', { count: s.trials_ending_7d })} tone="warning" /> : undefined}
              note={t('app.sa_trials_ending', { count: 0 })}
            />
            <StatTile
              label={t('app.sad_overdue')}
              value={formatNumber(inv.overdue)}
              chip={<Chip label={t('app.sad_unpaid', { count: inv.unpaid })} tone={inv.overdue ? 'destructive' : 'muted'} />}
              onPress={() => go('/superadmin/billing')}
            />
          </View>
        </View>

        {recs.length ? (
          <Section title={t('app.sad_plans')}>
            <PlanMix records={recs} />
          </Section>
        ) : null}

        <Section title={t('app.sad_attention')} onViewAll={() => go('/superadmin/schools')}>
          <Panel>
            {attention.length ? (
              attention.map((a, i) => <AttentionRow key={a.key} a={a} last={i === attention.length - 1} />)
            ) : (
              <Text variant="muted" className="p-4 text-sm">
                {t('app.sad_all_good')}
              </Text>
            )}
          </Panel>
        </Section>

        <Section title={t('app.sad_support')} onViewAll={() => go('/superadmin/inbox')}>
          <Panel>
            {openFeedback.length ? (
              openFeedback.slice(0, 3).map((f, i, arr) => <FeedbackRow key={f.id} f={f} last={i === arr.length - 1} />)
            ) : (
              <Text variant="muted" className="p-4 text-sm">
                {t('app.ib_no_feedback')}
              </Text>
            )}
          </Panel>
        </Section>

        {stats.data ? (
          <Section title={t('app.sad_activity')}>
            <View className="flex-row gap-3">
              {[
                [formatNumber(stats.data.totalBillings), t('app.sa_ps_total_billings')],
                [formatNumber(stats.data.paidBillings), t('app.sa_ps_paid')],
                [formatNumber(stats.data.suspendedSchools), t('app.sa_ps_suspended')],
              ].map(([v, l]) => (
                <Panel key={l} className="flex-1 gap-0.5 p-3">
                  <Text className="text-lg font-bold">{v}</Text>
                  <Text variant="muted" className="text-[11px]" numberOfLines={2}>
                    {l}
                  </Text>
                </Panel>
              ))}
            </View>
          </Section>
        ) : null}

        <YearCharts />

        <Section title={t('app.sad_quick')}>
          <View className="flex-row gap-3">
            <QuickAction icon={Building2} label={t('app.sa_tab_schools')} href="/superadmin/schools" />
            <QuickAction icon={Plus} label={t('app.sad_onboard')} href="/superadmin/onboard" />
            <QuickAction icon={CreditCard} label={t('app.sa_tab_billing')} href="/superadmin/billing" />
            <QuickAction icon={Settings} label={t('app.sad_settings')} href="/superadmin/settings" />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
