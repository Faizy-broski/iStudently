import type { FeeWithPayments } from '@studently/api-client';
import { Stack } from 'expo-router';
import { AlertCircle, Check, CheckCircle, Clock, Download, Filter, Receipt, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { colors as themeColors } from '@/lib/colors';
import { BrandGradient } from '@/components/app/brand-gradient';
import { FilterChips } from '@/components/app/filter-chips';
import { Panel } from '@/components/app/panel';
import { Picker } from '@/components/app/picker';
import { LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ChildSwitcher, NoChild, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { FeeDueDateBadge } from '@/features/portal/fees';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';
import { daysUntil, formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';

type Bucket = 'paid' | 'pending' | 'overdue';
const isPaid = (f: FeeWithPayments) => f.status === 'paid' || f.balance <= 0;
const bucketOf = (f: FeeWithPayments, now: Date): Bucket => (isPaid(f) ? 'paid' : f.due_date && new Date(f.due_date) < now ? 'overdue' : 'pending');
const TONE: Record<Bucket, { box: string; text: string; icon: LucideIcon }> = {
  paid: { box: 'bg-success-soft', text: 'text-success', icon: CheckCircle },
  pending: { box: 'bg-warning-soft', text: 'text-warning', icon: Clock },
  overdue: { box: 'bg-destructive-soft', text: 'text-destructive', icon: AlertCircle },
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
    const colors = { paid: [themeColors.successSoft, themeColors.success], pending: [themeColors.warningSoft, themeColors.warning], overdue: [themeColors.destructiveSoft, themeColors.destructive] }[b];
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
    const css = `.head{text-align:center;border-bottom:2px solid ${themeColors.printText};padding-bottom:16px;margin-bottom:24px}.head h1{margin:0}.head p{margin:4px 0;color:${themeColors.printMuted}}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:24px}.box{padding:12px;background:${themeColors.printSurface};border-radius:8px}.box label{font-size:12px;color:${themeColors.printMuted};display:block}.box span{font-size:15px;font-weight:bold}
      .status{display:inline-block;padding:4px 12px;border-radius:20px}.amounts{background:${themeColors.successSoft};padding:16px;border-radius:8px;margin-bottom:24px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid ${themeColors.successSoft}}.row:last-child{border-bottom:none;font-size:17px;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-bottom:24px}th,td{padding:8px;border:1px solid ${themeColors.printBorder};text-align:start}th{background:${themeColors.printSurface}}.foot{margin-top:32px;text-align:center;font-size:12px;color:${themeColors.printMuted}}`;
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

  // Hero: outstanding balance (pending + overdue) and the next unpaid fee.
  const unpaid = [...groups.overdue, ...groups.pending].sort((a, b) => time(a) - time(b));
  const next = unpaid[0] ?? null;
  const outstanding = pendingAmount + overdueAmount;
  const nextDays = next?.due_date ? daysUntil(next.due_date, now) : null;
  // Payment history from all fees (newest first).
  const history = all
    .flatMap((f) => (f.payments ?? []).map((p) => ({ fee: f, p })))
    .sort((a, b) => new Date(b.p.payment_date || 0).getTime() - new Date(a.p.payment_date || 0).getTime());
  const chipTone: Record<Bucket, 'success' | 'warning' | 'destructive'> = { paid: 'success', pending: 'warning', overdue: 'destructive' };

  return (
    <>
      <Stack.Screen options={{ title: t('student_billing.fees.title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => fees.mutate()} />}>
        <ChildSwitcher />

        {/* Outstanding balance */}
        <BrandGradient variant="primary" angle={150} style={{ borderRadius: 24 }}>
          <View className="gap-2 p-5">
            <Text className="text-white text-xs opacity-80">{k('outstanding')}</Text>
            <Text className="text-white text-3xl font-bold">{money(outstanding)}</Text>
            {next ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="bg-warning-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                  <Icon as={Clock} className="text-warning size-3" />
                  <Text className="text-warning text-[11px] font-semibold">{`${k('due')} ${next.due_date ? formatDate(next.due_date) : '—'}`}</Text>
                </View>
                {nextDays !== null ? <Text className="text-white text-xs opacity-80">{nextDays >= 0 ? k('days_left', { count: nextDays }) : k('days_overdue', { count: -nextDays })}</Text> : null}
              </View>
            ) : (
              <Text className="text-white text-xs opacity-80">{k('all_settled')}</Text>
            )}
            {next ? (
              <Pressable onPress={() => challan(next)} className="mt-2 overflow-hidden rounded-full" accessibilityRole="button">
                <BrandGradient variant="gold" style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon as={Download} className="text-white size-4" />
                  <Text className="text-white font-semibold">{k('challan_next')}</Text>
                </BrandGradient>
              </Pressable>
            ) : null}
          </View>
        </BrandGradient>

        <View className="flex-row gap-2.5">
          <Stat bucket="paid" amount={money(paidAmount)} label={k('stat_paid', { count: groups.paid.length })} />
          <Stat bucket="pending" amount={money(pendingAmount)} label={k('stat_pending', { count: groups.pending.length })} />
          <Stat bucket="overdue" amount={money(overdueAmount)} label={k('stat_overdue', { count: groups.overdue.length })} />
        </View>

        {/* Fee breakdown with month filter and status tabs */}
        <View className="gap-2.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold">{k('details_title')}</Text>
          </View>
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
            <Panel className="items-center gap-1 py-8">
              <Icon as={empty.icon} className={cn('mb-2 size-10', empty.good ? 'text-success' : 'text-muted-foreground')} />
              <Text className={cn('font-semibold', empty.good ? 'text-success' : 'text-muted-foreground')}>{empty.title}</Text>
              <Text className="text-muted-foreground text-center text-sm">{empty.body}</Text>
            </Panel>
          ) : (
            <Panel>
              {groups[tab].map((f, i, arr) => {
                const b = bucketOf(f, now);
                return (
                  <View key={f.id} className={cn('gap-1 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                    <View className="flex-row items-center gap-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold" numberOfLines={1}>
                          {f.fee_name || f.category || k('fee')}
                        </Text>
                        <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                          {[f.due_date ? `${k('due')}: ${formatDate(f.due_date)}` : null, `${k('amount')}: ${money(f.final_amount || 0)}`].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Text className="text-sm font-bold">{money(b === 'paid' ? f.final_amount : f.balance)}</Text>
                      <StatusChip label={k(b)} tone={chipTone[b]} className="px-2 py-0.5" />
                    </View>
                    <View className="flex-row items-center justify-between gap-2">
                      {f.amount_paid > 0 && b !== 'paid' ? <Text className="text-success flex-1 text-[11px]">{k('partial', { paid: money(f.amount_paid), balance: money(f.balance) })}</Text> : <FeeDueDateBadge dueDate={f.due_date} status={f.status} />}
                      <Pressable onPress={() => challan(f)} className="bg-info-soft flex-row items-center gap-1 rounded-full px-2.5 py-1" accessibilityRole="button">
                        <Icon as={Download} className="text-brand dark:text-brand-secondary size-3.5" />
                        <Text className="text-brand dark:text-brand-secondary text-[11px] font-semibold">{k('challan')}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Panel>
          )}
        </View>

        {/* Payment history */}
        {history.length ? (
          <View className="gap-2.5">
            <Text className="text-base font-semibold">{k('payment_history')}</Text>
            <Panel>
              {history.slice(0, 10).map(({ fee, p }, i, arr) => (
                <View key={`${fee.id}:${i}`} className={cn('flex-row items-center gap-3 px-4 py-3', i < arr.length - 1 && 'border-info-soft dark:border-border border-b')}>
                  <View className="border-success size-8 items-center justify-center rounded-full border-2">
                    <Icon as={Check} strokeWidth={3} className="text-success size-3.5" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold" numberOfLines={1}>
                      {fee.fee_name || fee.category || k('fee')}
                    </Text>
                    <Text variant="muted" className="text-[11px]" numberOfLines={1}>
                      {[p.payment_date ? formatDate(p.payment_date) : null, p.payment_method].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold">{money(p.amount || 0)}</Text>
                </View>
              ))}
            </Panel>
          </View>
        ) : null}

        <View className="bg-info-soft gap-2 rounded-2xl p-4">
          <View className="flex-row items-center gap-2">
            <Icon as={AlertCircle} className="text-brand dark:text-brand-secondary size-5" />
            <Text className="text-brand dark:text-foreground font-bold">{k('info_title')}</Text>
          </View>
          {[1, 2, 3, 4].map((i) => (
            <Text key={i} className="text-sm">{`• ${k(`info_${i}`)}`}</Text>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

function Stat({ bucket, amount, label }: { bucket: Bucket; amount: string; label: string }) {
  const tone = TONE[bucket];
  return (
    <Panel className="flex-1 items-center gap-1 p-3">
      <View className={cn('rounded-full p-1.5', tone.box)}>
        <Icon as={tone.icon} className={cn('size-4', tone.text)} />
      </View>
      <Text className={cn('text-sm font-bold', tone.text)} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
      <Text className="text-muted-foreground text-center text-[11px]">{label}</Text>
    </Panel>
  );
}
