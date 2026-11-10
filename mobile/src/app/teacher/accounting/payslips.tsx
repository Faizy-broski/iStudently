import type { Payslip } from '@studently/api-client';
import { Stack } from 'expo-router';
import { FileText, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { IconTile, RowPill } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { StatusChip, type ChipTone } from '@/components/app/status-chip';
import { useToast } from '@/components/app/toast';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { payslipPageHtml } from '@/features/admin/salary';
import { usePortalCurrency } from '@/features/portal/currency';
import i18n from '@/i18n';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, printHtml } from '@/lib/print';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<string, ChipTone> = { pending: 'warning', approved: 'info', paid: 'success' };
const periodLabel = (month: number, year: number) => new Date(year, month - 1, 1).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en', { month: 'long', year: 'numeric' });

/**
 * The signed-in teacher's monthly pay stubs with base, deductions and net, each printable
 * (web: /teacher/accounting/payslips). Months come from the teacher's own salary records
 * (/accounting/staff/salary-records); each month's stub from /accounting/staff/payslip.
 */
export default function TeacherPayslips() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPortal.accounting.payslips.${key}`, o);
  const toast = useToast();
  const ctx = usePrintContext();
  const { money } = usePortalCurrency();
  const [printing, setPrinting] = useState<string | null>(null);

  const salaryRecords = useApi(['teacher', 'salary-records'], () => teacher.mySalaryRecords({ limit: 100 }));
  const periods = [...new Set((salaryRecords.data ?? []).map((r) => `${r.year}-${r.month}`))]
    .map((p) => p.split('-').map(Number) as [number, number])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1])
    .slice(0, 50);
  const key = periods.map(([y, m]) => `${y}-${m}`).join(',');
  const stubs = useApi(salaryRecords.data ? ['teacher', 'payslips', key] : null, async ([, , list]) => {
    const wanted = (list as string).split(',').filter(Boolean).map((p) => p.split('-').map(Number));
    const res = await Promise.all(wanted.map(([y, m]) => teacher.myPayslip(m, y)));
    const data = res.flatMap((r) => (r.success && r.data ? [r.data] : []));
    const failed = res.find((r) => !r.success);
    if (!data.length && failed) return { success: false as const, error: failed.error || k('load_error') };
    return { success: true as const, data };
  });
  const records = (stubs.data ?? []) as Payslip[];

  async function print(p: Payslip) {
    setPrinting(p.id);
    try {
      await printHtml(buildPrintHtml({ title: k('print_pay_stub'), pages: [payslipPageHtml(p, t, money)], school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : k('print_error'));
    } finally {
      setPrinting(null);
    }
  }

  const loading = salaryRecords.isLoading || stubs.isLoading;
  const error = salaryRecords.error ?? stubs.error;
  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-8" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([salaryRecords.mutate(), stubs.mutate()])} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        {loading ? (
          <LoadingList rows={4} />
        ) : error ? (
          <ErrorState message={error.message || k('load_error')} onRetry={() => Promise.all([salaryRecords.mutate(), stubs.mutate()])} />
        ) : !records.length ? (
          <EmptyState icon={FileText} title={k('no_records')} />
        ) : (
          <Panel>
            {records.map((p, i) => (
              <View key={p.id} className={cn('flex-row items-start gap-3 px-4 py-3', i < records.length - 1 && 'border-info-soft dark:border-border border-b')}>
                <IconTile icon={FileText} size={40} />
                <View className="flex-1 gap-1.5">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-semibold">{periodLabel(p.month, p.year)}</Text>
                    <StatusChip label={p.status} tone={STATUS_TONE[p.status] ?? 'muted'} />
                  </View>
                  <Row label={k('col_base_salary')} value={money(Number(p.base_salary))} />
                  <Row label={k('col_deductions')} value={Number(p.total_deductions) > 0 ? `-${money(Number(p.total_deductions))}` : '-'} tone="text-destructive" />
                  <Row label={k('col_net_payable')} value={money(Number(p.net_salary))} tone="text-brand dark:text-brand-secondary font-bold" />
                  <View className={cn('items-end pt-1', printing === p.id && 'opacity-50')} pointerEvents={printing === p.id ? 'none' : 'auto'}>
                    <RowPill icon={Printer} label={k('print_pay_stub')} onPress={() => print(p)} />
                  </View>
                </View>
              </View>
            ))}
          </Panel>
        )}
      </ScrollView>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="muted" className="text-xs">
        {label}
      </Text>
      <Text className={cn('text-sm', tone)}>{value}</Text>
    </View>
  );
}
