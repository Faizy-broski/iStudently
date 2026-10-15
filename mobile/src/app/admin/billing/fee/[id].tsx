import type { StudentFeeDetail } from '@studently/api-client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Clock, CreditCard, FileText, History, Printer, SlidersHorizontal } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FilterChips } from '@/components/app/filter-chips';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AdjustmentRow, FeeStatusBadge } from '@/features/admin/fee-records';
import { usePrintContext } from '@/features/admin/print-context';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminFees } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

type Line = { label: string; note?: string; amount: string; tone?: 'green' | 'orange' | 'total' | 'due' };

/** One fee record: breakdown, payments and adjustment history, printable as a challan (web: FeeChallanModal). */
export default function FeeChallan() {
  const { t } = useTranslation();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const print = usePrintContext();
  const [tab, setTab] = useState<'details' | 'payments' | 'adjustments'>('details');
  const fee = useApi(scopeId && id ? ['admin', 'student-fee', scopeId, id] : null, ([, , sid, fid]) => adminFees.studentFee(sid as string, fid as string));
  const adjustments = useApi(scopeId && id ? ['admin', 'fee-adjustments', scopeId, id] : null, ([, , sid, fid]) => adminFees.adjustments(sid as string, fid as string));
  const refresh = () => {
    fee.mutate();
    adjustments.mutate();
  };

  if (fee.isLoading) return <LoadingList rows={5} />;
  if (fee.error || !fee.data) return <ErrorState message={fee.error?.message} onRetry={refresh} />;
  const d: StudentFeeDetail = fee.data;
  const pr = d.students?.profiles;
  const studentName = pr ? [pr.first_name, pr.father_name, pr.last_name].filter(Boolean).join(' ') : '—';
  const number = d.students?.student_number ?? '';
  const category = d.fee_structures?.fee_categories?.name ?? '—';
  const adjList = adjustments.data ?? [];
  const payments = d.payments ?? [];

  const lines: Line[] = [
    ...(d.fee_breakdown?.length
      ? d.fee_breakdown.map((c) => ({ label: c.category_name, note: c.category_code ? `(${c.category_code})` : undefined, amount: money(c.amount) }))
      : [{ label: category, note: `(${t('app.fr_base_fee')})`, amount: money(d.base_amount) }]),
    ...((d.services_amount ?? 0) > 0 ? [{ label: t('app.fr_service_charges'), amount: money(d.services_amount ?? 0) }] : []),
    ...(d.sibling_discount > 0 ? [{ label: t('app.fr_sibling_discount'), amount: `-${money(d.sibling_discount)}`, tone: 'green' as const }] : []),
    ...(d.custom_discount > 0
      ? [{ label: t('app.fr_custom_discount'), note: d.discount_reason ? `(${d.discount_reason})` : undefined, amount: `-${money(d.custom_discount)}`, tone: 'green' as const }]
      : []),
    ...(d.late_fee_applied > 0
      ? [{ label: t('app.fr_late_fee'), note: d.late_fee_applied_at ? formatDate(d.late_fee_applied_at) : undefined, amount: `+${money(d.late_fee_applied)}`, tone: 'orange' as const }]
      : []),
    { label: t('app.fr_total_amount'), amount: money(d.final_amount), tone: 'total' },
    { label: t('app.fr_amount_paid'), amount: `-${money(d.amount_paid)}`, tone: 'green' },
    { label: t('app.fr_balance_due'), amount: money(d.final_amount - d.amount_paid), tone: 'due' },
  ];

  async function output(mode: 'print' | 'pdf') {
    const title = t('app.fr_challan');
    const rows = lines
      .map(
        (l) =>
          `<tr style="${l.tone === 'total' ? 'font-weight:bold;background:#f9f9f9' : l.tone === 'due' ? 'font-weight:bold;background:#ecfdf5' : ''}"><td style="border:1px solid #ddd;padding:8px">${escapeHtml(l.label)}${l.note ? ` <span style="color:#666;font-size:11px">${escapeHtml(l.note)}</span>` : ''}</td><td style="border:1px solid #ddd;padding:8px;text-align:end">${escapeHtml(l.amount)}</td></tr>`,
      )
      .join('');
    const body = `<div style="text-align:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px"><h1 style="margin:0">${escapeHtml(title.toUpperCase())}</h1><p style="margin:4px 0;color:#666">${escapeHtml(t('app.fr_academic_year', { year: d.academic_year }))}</p></div>
      <table style="width:100%;margin-bottom:16px"><tr><td><div style="color:#666;font-size:12px">${escapeHtml(t('common.student'))}</div><div style="font-weight:bold">${escapeHtml(studentName)}</div><div>${escapeHtml(number)}</div></td>
      <td style="text-align:end"><div style="color:#666;font-size:12px">${escapeHtml(t('admin.fees.page.table.due_date'))}</div><div style="font-weight:bold">${escapeHtml(d.due_date ? formatDate(d.due_date) : '—')}</div><div>${escapeHtml(d.status.toUpperCase())}</div></td></tr></table>
      <table style="width:100%;border-collapse:collapse"><tr><th style="border:1px solid #ddd;padding:8px;text-align:start;background:#f5f5f5">${escapeHtml(t('app.fr_description'))}</th><th style="border:1px solid #ddd;padding:8px;text-align:end;background:#f5f5f5">${escapeHtml(t('common.amount'))}</th></tr>${rows}</table>
      ${d.notes ? `<p style="margin-top:12px;padding:10px;background:#fefce8;border:1px solid #fde68a"><strong>${escapeHtml(t('app.fr_note'))}:</strong> ${escapeHtml(d.notes)}</p>` : ''}
      <p style="margin-top:32px;text-align:center;font-size:11px;color:#666">${escapeHtml(t('app.fr_generated', { date: formatDate(new Date().toISOString()), time: new Date().toLocaleTimeString() }))}<br/>${escapeHtml(t('app.fr_computer_generated'))}</p>`;
    try {
      const html = buildPrintHtml({ title: `${title} - ${studentName}`, pages: [body], school: print.school, layout: print.layout, withHeader: true, reportLabel: title });
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, `challan_${number || d.id}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t('app.fr_challan') }} />
      <ScrollView
        className="bg-background flex-1"
        contentContainerClassName="gap-3 p-4 pb-10"
        refreshControl={<RefreshControl refreshing={fee.isValidating && !fee.isLoading} onRefresh={refresh} />}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold">{studentName}</Text>
            <Text className="text-muted-foreground text-sm">{[number, category, d.academic_year].filter(Boolean).join(' · ')}</Text>
          </View>
          <FeeStatusBadge status={d.status} />
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button variant="outline" size="sm" onPress={() => output('print')} disabled={!print.ready}>
            <Icon as={Printer} className="size-4" />
            <Text>{t('app.fr_print_challan')}</Text>
          </Button>
          <Button variant="outline" size="sm" onPress={() => output('pdf')} disabled={!print.ready}>
            <Icon as={FileText} className="size-4" />
            <Text>PDF</Text>
          </Button>
          <Button variant="outline" size="sm" onPress={() => router.push({ pathname: '/admin/billing/fee/adjust', params: { id: d.id } })}>
            <Icon as={SlidersHorizontal} className="size-4" />
            <Text>{t('admin.fees.page.actions.adjust')}</Text>
          </Button>
        </View>

        <FilterChips<'details' | 'payments' | 'adjustments'>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'details', label: t('app.fr_tab_details') },
            { value: 'payments', label: t('app.fr_tab_payments', { count: payments.length }) },
            { value: 'adjustments', label: t('app.fr_tab_adjustments', { count: adjList.length }) },
          ]}
        />

        {tab === 'details' ? (
          <>
            <Card className="py-3">
              <CardContent className="flex-row justify-between gap-3 px-4">
                <View className="flex-1">
                  <Text className="text-muted-foreground text-xs">{t('common.student')}</Text>
                  <Text className="font-semibold">{studentName}</Text>
                  <Text className="text-muted-foreground text-sm">{number}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-muted-foreground text-xs">{t('admin.fees.page.table.due_date')}</Text>
                  <Text className="font-semibold">{d.due_date ? formatDate(d.due_date) : '—'}</Text>
                </View>
              </CardContent>
            </Card>
            <Card className="gap-0 py-0">
              <CardContent className="px-0">
                <View className="bg-muted flex-row justify-between px-4 py-2">
                  <Text className="text-sm font-semibold">{t('app.fr_description')}</Text>
                  <Text className="text-sm font-semibold">{t('common.amount')}</Text>
                </View>
                {lines.map((l, i) => (
                  <View
                    key={`${l.label}-${i}`}
                    className={cn(
                      'border-border flex-row items-start justify-between gap-3 border-t px-4 py-2.5',
                      l.tone === 'total' && 'bg-muted/50',
                      l.tone === 'due' && 'bg-emerald-50 dark:bg-emerald-900/30',
                    )}>
                    <View className="flex-1">
                      <Text
                        className={cn(
                          'text-sm',
                          l.tone === 'green' && 'text-green-700 dark:text-green-400',
                          l.tone === 'orange' && 'text-orange-700 dark:text-orange-400',
                          (l.tone === 'total' || l.tone === 'due') && 'font-bold',
                          l.tone === 'due' && 'text-emerald-800 dark:text-emerald-300',
                        )}>
                        {l.label}
                      </Text>
                      {l.note ? (
                        <View className="flex-row items-center gap-1">
                          {l.tone === 'orange' ? <Icon as={Clock} className="text-muted-foreground size-3" /> : null}
                          <Text className="text-muted-foreground text-xs">{l.note}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      className={cn(
                        'text-sm',
                        l.tone === 'green' && 'text-green-700 dark:text-green-400',
                        l.tone === 'orange' && 'text-orange-700 dark:text-orange-400',
                        (l.tone === 'total' || l.tone === 'due') && 'font-bold',
                        l.tone === 'due' && 'text-emerald-800 dark:text-emerald-300',
                      )}>
                      {l.amount}
                    </Text>
                  </View>
                ))}
              </CardContent>
            </Card>
            {d.notes ? (
              <View className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-900/30">
                <Text className="text-sm text-yellow-800 dark:text-yellow-300">{`${t('app.fr_note')}: ${d.notes}`}</Text>
              </View>
            ) : null}
          </>
        ) : null}

        {tab === 'payments' ? (
          payments.length === 0 ? (
            <EmptyState icon={CreditCard} title={t('app.fr_no_payments')} />
          ) : (
            payments.map((pay) => (
              <Card key={pay.id} className="py-3">
                <CardContent className="gap-1 px-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="font-semibold text-green-700 dark:text-green-400">{money(pay.amount)}</Text>
                      <Text className="text-muted-foreground text-sm">
                        {[pay.payment_method || t('app.fr_cash'), pay.payment_reference ? t('app.fr_ref', { ref: pay.payment_reference }) : null].filter(Boolean).join(' • ')}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-sm">{formatDate(pay.payment_date)}</Text>
                      <Text className="text-muted-foreground text-xs">{new Date(pay.payment_date).toLocaleTimeString()}</Text>
                    </View>
                  </View>
                  {pay.notes ? <Text className="text-muted-foreground text-sm italic">{`"${pay.notes}"`}</Text> : null}
                </CardContent>
              </Card>
            ))
          )
        ) : null}

        {tab === 'adjustments' ? (
          adjList.length === 0 ? (
            <EmptyState icon={History} title={t('app.fr_no_adjustments')} />
          ) : (
            adjList.map((a) => <AdjustmentRow key={a.id} adj={a} money={money} showBeforeAfter />)
          )
        ) : null}
      </ScrollView>
    </>
  );
}
