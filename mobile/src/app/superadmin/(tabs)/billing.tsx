import type { BillingPlan, BillingRecord, PaymentStatus } from '@studently/api-client';
import { toCsv, todayIso } from '@studently/shared-utils';
import { router } from 'expo-router';
import { Loader, Plus, Share2 } from 'lucide-react-native';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBackground } from '@/components/app/auth-background';
import { BrandGradient } from '@/components/app/brand-gradient';
import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { SearchBar } from '@/components/app/search-bar';
import { Segmented } from '@/components/app/segmented';
import { StatusChip } from '@/components/app/status-chip';
import { raised } from '@/components/app/tile-grid';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PAY_TONE } from '@/features/superadmin/billing';
import { platform } from '@/lib/api';
import { useColors } from '@/lib/colors';
import { useApi, usePagedApi } from '@/lib/data';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { shareTextFile } from '@/lib/share-file';
import { useDebounced } from '@/lib/use-debounced';

type Section = 'invoices' | 'plans';
type StatusFilter = 'all' | PaymentStatus;

const CARD_LIST = { ItemSeparatorComponent: () => <View className="h-2" />, contentContainerClassName: 'flex-grow px-4 pb-6' };

/** Raised list card (Figma style). */
function Card({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 active:opacity-80">
      {children}
    </Pressable>
  );
}

/** Compact invoice row: initial, school, number · due, amount and status. */
function InvoiceCard({ r }: { r: BillingRecord }) {
  const { t } = useTranslation();
  const status = r.effective_status ?? r.payment_status;
  const name = r.school_name ?? '—';
  return (
    <Card onPress={() => router.push({ pathname: '/superadmin/billing/record/[id]', params: { id: r.id } })}>
      <View className="bg-info-soft size-9 items-center justify-center rounded-full">
        <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{name.trim().charAt(0)}</Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
          {`${r.invoice_number} · ${t('app.sa_due', { date: formatDate(r.due_date) })}`}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-sm font-bold">{formatMoney(r.amount, r.currency)}</Text>
        <StatusChip label={t(`app.sa_pay_status_${status}`)} tone={PAY_TONE[status]} className="px-2 py-0.5" />
      </View>
    </Card>
  );
}

/** Compact plan row: name, prices, status. */
function PlanCard({ p }: { p: BillingPlan }) {
  const { t } = useTranslation();
  return (
    <Card onPress={() => router.push({ pathname: '/superadmin/billing/plan-form', params: { id: p.id } })}>
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {p.name}
        </Text>
        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
          {[t('app.bl_plan_prices', { q: p.quarterly_price, y: p.yearly_price }), p.max_students ? t('app.bl_max_students', { count: p.max_students }) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-brand dark:text-brand-secondary text-sm font-bold">{t('app.bl_per_month', { amount: p.monthly_price })}</Text>
        <StatusChip label={p.is_active ? t('app.sa_status_active') : t('app.bl_inactive')} tone={p.is_active ? 'success' : 'muted'} className="px-2 py-0.5" />
      </View>
    </Card>
  );
}

function Invoices({ header }: { header: ReactElement }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const key = `platform-records:${status}:${q}`;
  const list = usePagedApi<BillingRecord>(key, (page) =>
    platform.listRecords({ page, limit: 25, status: status === 'all' ? undefined : status, search: q || undefined }),
  );

  const [exporting, setExporting] = useState(false);

  /** Same columns as the web's "Export report", for the current filter and search (all pages). */
  async function exportCsv() {
    setExporting(true);
    try {
      const rows: BillingRecord[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await platform.listRecords({ page, limit: 100, status: status === 'all' ? undefined : status, search: q || undefined });
        if (!res.success) return toast.error(res.error || t('app.error_title'));
        rows.push(...(res.data ?? []));
        if (page >= (res.pagination?.totalPages ?? 1)) break;
      }
      if (rows.length === 0) return toast.info(t('app.bl_no_invoices'));
      const csv = toCsv(
        ['School Name', 'Invoice Number', 'Plan', 'Billing Cycle', 'Amount', 'Currency', 'Start Date', 'Due Date', 'Status', 'Payment Date'],
        rows.map((r) => [r.school_name, r.invoice_number, r.subscription_plan, r.billing_cycle, r.amount, r.currency, r.start_date, r.due_date, r.effective_status, r.payment_date ?? '']),
      );
      await shareTextFile(`billing-report-${todayIso()}.csv`, csv, 'text/csv', 'public.comma-separated-values-text');
    } catch {
      toast.error(t('app.error_title'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <DataList
      {...CARD_LIST}
      header={
        <View className="gap-3 pb-3">
          {header}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.bl_search_invoices')} />
            </View>
            <Pressable onPress={exportCsv} disabled={exporting} className="border-info-soft dark:border-border bg-card size-11 items-center justify-center rounded-full border" accessibilityRole="button" accessibilityLabel={t('app.bl_export')}>
              <Icon as={exporting ? Loader : Share2} className="text-brand dark:text-brand-secondary size-4" />
            </Pressable>
          </View>
          <FilterChips<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: t('app.sa_filter_all') },
              { value: 'overdue', label: t('app.sa_pay_status_overdue') },
              { value: 'unpaid', label: t('app.sa_pay_status_unpaid') },
              { value: 'pending', label: t('app.sa_pay_status_pending') },
              { value: 'paid', label: t('app.sa_pay_status_paid') },
            ]}
          />
        </View>
      }
      items={list.data ? list.items : undefined}
      error={list.error}
      isLoading={list.isLoading}
      isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
      onRefresh={() => list.mutate()}
      onEndReached={list.loadMore}
      loadingMore={list.isValidating && list.size > 1}
      emptyTitle={t('app.bl_no_invoices')}
      emptyBody={t('app.bl_no_invoices_body')}
      keyExtractor={(r) => r.id}
      keyboardShouldPersistTaps="handled"
      renderItem={(r) => <InvoiceCard r={r} />}
    />
  );
}

function Plans({ header }: { header: ReactElement }) {
  const { t } = useTranslation();
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'plans', 'all'], () => platform.listPlans(true));
  return (
    <DataList
      {...CARD_LIST}
      header={<View className="pb-3">{header}</View>}
      items={data}
      error={error}
      isLoading={isLoading}
      isRefreshing={isValidating && !isLoading}
      onRefresh={() => mutate()}
      emptyTitle={t('app.bl_no_plans')}
      keyExtractor={(p) => p.id}
      renderItem={(p) => <PlanCard p={p} />}
    />
  );
}

/** Outstanding / overdue / paid this month, in the platform currency. */
function Summary() {
  const { t } = useTranslation();
  const summary = useApi(['platform', 'summary'], () => platform.getSummary());
  const settings = useApi(['platform', 'settings'], () => platform.getPlatformSettings());
  const d = summary.data;
  if (!d) return null;
  const currency = settings.data?.currency ?? d.revenue[0]?.currency ?? 'USD';
  const r = d.revenue.find((x) => x.currency === currency);
  const items: [string, string][] = [
    [t('app.sad_outstanding'), formatMoney(r?.outstanding ?? 0, currency)],
    [t('app.sad_overdue'), formatNumber(d.invoices.overdue)],
    [t('app.sad_paid_month'), formatMoney(r?.paid_this_month ?? 0, currency)],
  ];
  return (
    <View className="flex-row gap-2.5">
      {items.map(([label, value]) => (
        <View key={label} className="border-info-soft dark:border-border bg-card flex-1 gap-0.5 rounded-2xl border px-3 py-2.5">
          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
            {label}
          </Text>
          <Text className="text-sm font-bold" numberOfLines={1}>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function SuperadminBilling() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('invoices');
  const header = (
    <View className="gap-4 pt-2">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-brand dark:text-foreground text-2xl font-bold">{t('app.sa_tab_billing')}</Text>
          <Text variant="muted" className="text-xs">
            {t('app.bl_subtitle')}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push(section === 'invoices' ? '/superadmin/billing/record-form' : '/superadmin/billing/plan-form')}
          accessibilityRole="button"
          accessibilityLabel={section === 'invoices' ? t('app.bl_new_invoice') : t('app.bl_new_plan')}>
          <BrandGradient variant="primary" angle={135} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon as={Plus} strokeWidth={2.6} className="size-5 text-white" />
          </BrandGradient>
        </Pressable>
      </View>
      <Summary />
      <Segmented<Section>
        value={section}
        onChange={setSection}
        options={[
          { value: 'invoices', label: t('app.bl_invoices') },
          { value: 'plans', label: t('app.bl_plans') },
        ]}
      />
    </View>
  );
  return (
    <AuthBackground>
      <SafeAreaView edges={['top']} className="flex-1">
        {section === 'invoices' ? <Invoices header={header} /> : <Plans header={header} />}
      </SafeAreaView>
    </AuthBackground>
  );
}
