import type { FeeWithPayments } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, Calendar, CheckCircle, Clock, Download, Filter, Receipt, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { FeeDueDateBadge } from '@/features/portal/fees';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

type Bucket = 'paid' | 'pending' | 'overdue';
const isPaid = (f: FeeWithPayments) => f.status === 'paid' || f.balance <= 0;
const bucketOf = (f: FeeWithPayments, now: Date): Bucket => (isPaid(f) ? 'paid' : f.due_date && new Date(f.due_date) < now ? 'overdue' : 'pending');
const TONE: Record<Bucket, { box: string; text: string; icon: LucideIcon }> = {
  paid: { box: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600', icon: CheckCircle },
  pending: { box: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600', icon: Clock },
  overdue: { box: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600', icon: AlertCircle },
};

/**
 * The selected child's fees split into paid / pending / overdue with a month filter, and a printable
 * fee challan per invoice (web: /parent/fees, opened from the dashboard).
 */
export default function ParentFeeChallans() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`app.pa_fc_${key}`, o);
  const toast = useToast();
  const { money } = usePortalCurrency();
  const { child, childId } = useChild();
  const fees = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  const [now] = useState(() => new Date());
  const [month, setMonth] = useState(0);
  const year = now.getFullYear();
  const [tab, setTab] = useState<Bucket>('pending');

  if (!child) return <NoChild />;
  if (fees.isLoading) return <LoadingList rows={6} />;
  if (fees.error) return <PortalError title={t('student_billing.fees.error_loading')} message={fees.error.message} />;

  const all = fees.data ?? [];
  const filtered = month > 0 ? all.filter((f) => {
    const d = f.due_date ? new Date(f.due_date) : now;
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  }) : all;
  const groups: Record<Bucket, FeeWithPayments[]> = { paid: [], pending: [], overdue: [] };
  for (const f of filtered) groups[bucketOf(f, now)].push(f);
  const time = (f: FeeWithPayments) => new Date(f.due_date || 0).getTime();
  groups.paid.sort((a, b) => time(b) - time(a));
  groups.pending.sort((a, b) => time(a) - time(b));
  groups.overdue.sort((a, b) => time(a) - time(b));
  const paidAmount = groups.paid.reduce((s, f) => s + (f.final_amount || 0), 0);
  const pendingAmount = groups.pending.reduce((s, f) => s + (f.balance || 0), 0);
  const overdueAmount = groups.overdue.reduce((s, f) => s + (f.balance || 0), 0);
  const loc = i18n.language === 'ar' ? 'ar' : 'en';
  const monthName = (m: number) => new Date(2000, m - 1, 1).toLocaleDateString(loc, { month: 'long' });

  async function challan(fee: FeeWithPayments) {
    if (!child) return;
    const b = bucketOf(fee, new Date());
    const colors = { paid: ['#c8e6c9', '#2e7d32'], pending: ['#fff3e0', '#ef6c00'], overdue: ['#ffebee', '#c62828'] }[b];
    const box = (label: string, value: string) => `<div class="box"><label>${escapeHtml(label)}</label><span>${value}</span></div>`;
    const row = (label: string, value: string) => `<div class="row"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
    const td = (v: string) => `<td>${escapeHtml(v)}</td>`;
    const payments = fee.payments ?? [];
    const body = `<div class="head"><h1>${escapeHtml(k('challan_title'))}</h1><p>${escapeHtml(k('academic_year', { year: fee.academic_year || String(year) }))}</p><p>${escapeHtml(k('generated_on', { date: formatDate(new Date().toISOString()) }))}</p></div>
      <div class="grid">
        ${box(k('student_name'), escapeHtml(`${child.first_name} ${child.last_name}`))}
        ${box(k('student_id'), escapeHtml(child.student_number || 'N/A'))}
        ${box(k('class_section'), escapeHtml(`${child.grade_level || ''} - ${child.section || ''}`))}
        ${box(k('fee_type'), escapeHtml(fee.fee_name || fee.category || k('fee')))}
        ${box(k('due_date'), escapeHtml(fee.due_date ? formatDate(fee.due_date) : 'N/A'))}
        ${box(k('status'), `<b class="status" style="background:${colors[0]};color:${colors[1]}">${escapeHtml(k(b).toUpperCase())}</b>`)}
      </div>
      <div class="amounts">
        ${row(k('base_amount'), money(fee.base_amount || fee.final_amount || 0))}
        ${fee.final_amount !== fee.base_amount ? row(k('final_amount'), money(fee.final_amount || 0)) : ''}
        ${row(k('amount_paid'), money(fee.amount_paid || 0))}
        ${row(k('balance_due'), money(fee.balance || 0))}
      </div>
      ${payments.length ? `<h3>${escapeHtml(k('payment_history'))}</h3><table><tr><th>${escapeHtml(k('col_date'))}</th><th>${escapeHtml(k('col_amount'))}</th><th>${escapeHtml(k('col_method'))}</th><th>${escapeHtml(k('col_reference'))}</th></tr>${payments
        .map((p) => `<tr>${td(p.payment_date ? formatDate(p.payment_date) : 'N/A')}${td(money(p.amount || 0))}${td(p.payment_method || 'N/A')}${td(p.payment_reference || '-')}</tr>`)
        .join('')}</table>` : ''}
      <div class="foot"><p>${escapeHtml(k('footer_1'))}</p><p>${escapeHtml(k('footer_2'))}</p></div>`;
    const css = `.head{text-align:center;border-bottom:2px solid #333;padding-bottom:16px;margin-bottom:24px}.head h1{margin:0}.head p{margin:4px 0;color:#666}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}.box{padding:12px;background:#f5f5f5;border-radius:8px}.box label{font-size:12px;color:#666;display:block}.box span{font-size:15px;font-weight:bold}
      .status{display:inline-block;padding:4px 12px;border-radius:20px}.amounts{background:#e8f5e9;padding:16px;border-radius:8px;margin-bottom:24px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #c8e6c9}.row:last-child{border-bottom:none;font-size:17px;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}th,td{padding:8px;border:1px solid #ddd;text-align:start}th{background:#f5f5f5}.foot{margin-top:32px;text-align:center;font-size:12px;color:#666}`;
    try {
      await printHtml(buildPrintHtml({ title: `${k('challan_title')} - ${fee.fee_name}`, school: { name: child.campus_name }, pages: [body], extraCss: css }));
    } catch {
      toast.error(t('app.print_failed'));
    }
  }

  const empty = {
    paid: { icon: Receipt, title: k('empty_paid'), body: k('empty_paid_body'), good: false },
    pending: { icon: CheckCircle, title: k('empty_pending'), body: k('empty_pending_body'), good: true },
    overdue: { icon: CheckCircle, title: k('empty_overdue'), body: k('empty_overdue_body'), good: true },
  }[tab];

  return (
    <>
      <Stack.Screen options={{ title: t('student_billing.fees.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => fees.mutate()} />}>
        <Text variant="muted">{k('subtitle', { name: `${child.first_name} ${child.last_name}` })}</Text>
        <View className="flex-row gap-2">
          <Stat bucket="paid" amount={money(paidAmount)} label={k('stat_paid', { count: groups.paid.length })} />
          <Stat bucket="pending" amount={money(pendingAmount)} label={k('stat_pending', { count: groups.pending.length })} />
          <Stat bucket="overdue" amount={money(overdueAmount)} label={k('stat_overdue', { count: groups.overdue.length })} />
        </View>

        <Card>
          <CardHeader className="gap-3">
            <CardTitle>{k('details_title')}</CardTitle>
            <View className="flex-row items-center gap-2">
              <Icon as={Filter} className="text-muted-foreground size-4" />
              <View className="flex-1">
                <Picker
                  value={String(month)}
                  onChange={(v) => setMonth(Number(v))}
                  options={[{ value: '0', label: k('all_months') }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${monthName(i + 1)} ${year}` }))]}
                />
              </View>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            <FilterChips<Bucket>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'paid', label: `${k('paid')} (${groups.paid.length})` },
                { value: 'pending', label: `${k('pending')} (${groups.pending.length})` },
                { value: 'overdue', label: `${k('overdue')} (${groups.overdue.length})` },
              ]}
            />
            {groups[tab].length === 0 ? (
              <View className="items-center py-10">
                <Icon as={empty.icon} className={cn('mb-3 size-14', empty.good ? 'text-green-500' : 'text-muted-foreground')} />
                <Text className={cn('text-lg', empty.good ? 'text-green-600' : 'text-muted-foreground')}>{empty.title}</Text>
                <Text className="text-muted-foreground text-sm">{empty.body}</Text>
              </View>
            ) : (
              groups[tab].map((f) => {
                const b = bucketOf(f, now);
                const tone = TONE[b];
                return (
                  <View key={f.id} className="border-border gap-2 rounded-lg border p-3">
                    <View className="flex-row items-start gap-3">
                      <View className={cn('rounded-lg p-2', tone.box)}>
                        <Icon as={Receipt} className={cn('size-5', tone.text)} />
                      </View>
                      <View className="flex-1 gap-1">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <Text className="font-semibold" numberOfLines={1}>
                            {f.fee_name || f.category || k('fee')}
                          </Text>
                          <FeeDueDateBadge dueDate={f.due_date} status={f.status} />
                        </View>
                        <View className="flex-row flex-wrap items-center gap-3">
                          <Text className="text-muted-foreground text-xs">{`${k('amount')}: ${money(f.final_amount || 0)}`}</Text>
                          {f.due_date ? (
                            <View className="flex-row items-center gap-1">
                              <Icon as={Calendar} className="text-muted-foreground size-3" />
                              <Text className="text-muted-foreground text-xs">{`${k('due')}: ${formatDate(f.due_date)}`}</Text>
                            </View>
                          ) : null}
                        </View>
                        {f.amount_paid > 0 && b !== 'paid' ? <Text className="text-xs text-green-600">{k('partial', { paid: money(f.amount_paid), balance: money(f.balance) })}</Text> : null}
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      <View>
                        <Text className={cn('text-lg font-bold', tone.text)}>{money(b === 'paid' ? f.final_amount : f.balance)}</Text>
                        <Text className="text-muted-foreground text-xs">{b === 'paid' ? k('total_paid') : k('balance')}</Text>
                      </View>
                      <Button variant="outline" size="sm" onPress={() => challan(f)}>
                        <Icon as={Download} className="text-foreground size-4" />
                        <Text>{k('challan')}</Text>
                      </Button>
                    </View>
                  </View>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="gap-2 p-4">
            <View className="flex-row items-center gap-2">
              <Icon as={AlertCircle} className="size-5 text-blue-900 dark:text-blue-200" />
              <Text className="font-bold text-blue-900 dark:text-blue-200">{k('info_title')}</Text>
            </View>
            {[1, 2, 3, 4].map((i) => (
              <Text key={i} className="text-sm text-blue-800 dark:text-blue-300">{`• ${k(`info_${i}`)}`}</Text>
            ))}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}

function Stat({ bucket, amount, label }: { bucket: Bucket; amount: string; label: string }) {
  const tone = TONE[bucket];
  return (
    <Card className="flex-1">
      <CardContent className="items-center gap-1.5 p-3">
        <View className={cn('rounded-full p-2', tone.box)}>
          <Icon as={tone.icon} className={cn('size-5', tone.text)} />
        </View>
        <Text className={cn('text-base font-bold', tone.text)} numberOfLines={1} adjustsFontSizeToFit>
          {amount}
        </Text>
        <Text className="text-muted-foreground text-center text-xs">{label}</Text>
      </CardContent>
    </Card>
  );
}
