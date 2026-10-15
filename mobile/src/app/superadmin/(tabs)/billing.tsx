import type { BillingRecord, PaymentStatus } from '@studently/api-client';
import { toCsv, todayIso } from '@studently/shared-utils';
import { router } from 'expo-router';
import { Loader, Plus, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { FilterChips } from '@/components/app/filter-chips';
import { ListRow } from '@/components/app/list-row';
import { SearchBar } from '@/components/app/search-bar';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { PAY_VARIANT } from '@/features/superadmin/billing';
import { platform } from '@/lib/api';
import { useApi, usePagedApi } from '@/lib/data';
import { formatDate, formatMoney } from '@/lib/format';
import { shareTextFile } from '@/lib/share-file';
import { useDebounced } from '@/lib/use-debounced';

type Section = 'invoices' | 'plans';
type StatusFilter = 'all' | PaymentStatus;

function Invoices() {
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
    <View className="flex-1">
      <View className="gap-3 px-4 pb-2">
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <SearchBar value={search} onChangeText={setSearch} placeholder={t('app.bl_search_invoices')} />
          </View>
          <Button variant="outline" size="icon" onPress={exportCsv} disabled={exporting} accessibilityLabel={t('app.bl_export')}>
            <Icon as={exporting ? Loader : Share2} className="size-4" />
          </Button>
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
      <DataList
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
        renderItem={(r) => (
          <ListRow
            title={`${r.school_name ?? '—'}`}
            subtitle={`${r.invoice_number} · ${formatMoney(r.amount, r.currency)} · ${t('app.sa_due', { date: formatDate(r.due_date) })}`}
            trailing={
              <Badge variant={PAY_VARIANT[r.effective_status ?? r.payment_status]}>
                <Text>{t(`app.sa_pay_status_${r.effective_status ?? r.payment_status}`)}</Text>
              </Badge>
            }
            onPress={() => router.push({ pathname: '/superadmin/billing/record/[id]', params: { id: r.id } })}
          />
        )}
      />
    </View>
  );
}

function Plans() {
  const { t } = useTranslation();
  const { data, error, isLoading, isValidating, mutate } = useApi(['platform', 'plans', 'all'], () => platform.listPlans(true));
  return (
    <DataList
      items={data}
      error={error}
      isLoading={isLoading}
      isRefreshing={isValidating && !isLoading}
      onRefresh={() => mutate()}
      emptyTitle={t('app.bl_no_plans')}
      keyExtractor={(p) => p.id}
      renderItem={(p) => (
        <ListRow
          title={p.name}
          subtitle={[
            t('app.bl_per_month', { amount: p.monthly_price }),
            t('app.bl_plan_prices', { q: p.quarterly_price, y: p.yearly_price }),
            p.max_students ? t('app.bl_max_students', { count: p.max_students }) : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          trailing={
            p.is_active ? null : (
              <Badge variant="outline">
                <Text>{t('app.bl_inactive')}</Text>
              </Badge>
            )
          }
          onPress={() => router.push({ pathname: '/superadmin/billing/plan-form', params: { id: p.id } })}
        />
      )}
    />
  );
}

export default function SuperadminBilling() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('invoices');
  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center justify-between gap-3 px-4 pt-3 pb-3">
        <FilterChips<Section>
          value={section}
          onChange={setSection}
          options={[
            { value: 'invoices', label: t('app.bl_invoices') },
            { value: 'plans', label: t('app.bl_plans') },
          ]}
        />
        <Button
          size="sm"
          onPress={() => router.push(section === 'invoices' ? '/superadmin/billing/record-form' : '/superadmin/billing/plan-form')}>
          <Icon as={Plus} className="text-primary-foreground size-4" />
          <Text>{section === 'invoices' ? t('app.bl_new_invoice') : t('app.bl_new_plan')}</Text>
        </Button>
      </View>
      {section === 'invoices' ? <Invoices /> : <Plans />}
    </View>
  );
}
