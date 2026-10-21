import type { Payslip, SalaryRecord } from '@studently/api-client';
import { router, Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { DataList } from '@/components/app/data-list';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { MonthYearPicker, SALARY_STATUS_VARIANT, monthLabel, payslipPageHtml, staffName } from '@/features/admin/salary';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { usePagedApi } from '@/lib/data';
import { buildPrintHtml, printHtml, sharePdf } from '@/lib/print';

/** Bulk-loaded pay stubs are fetched one by one; cap a single print run. */
const MAX_STUBS = 300;

/** Monthly pay stubs for all staff, one tap to print or share them all (web: /admin/staff/financial-statements). */
export default function FinancialStatements() {
  const { t } = useTranslation();
  const f = (k: string, o?: Record<string, unknown>) => t(`financial_statements.${k}`, o);
  const toast = useToast();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const print = usePrintContext();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [busy, setBusy] = useState<{ kind: 'print' | 'pdf'; done: number; total: number } | null>(null);
  const list = usePagedApi<SalaryRecord>(scopeId ? `admin-salary-records:${scopeId}:${month}:${year}:all` : null, (page) => adminSalary.records(scopeId!, { month, year, page, limit: 20 }));
  const total = list.total ?? list.items.length;

  async function printAll(kind: 'print' | 'pdf') {
    if (!scopeId) return;
    setBusy({ kind, done: 0, total: 0 });
    try {
      const records: SalaryRecord[] = [];
      for (let page = 1; records.length < MAX_STUBS; page++) {
        const res = await adminSalary.records(scopeId, { month, year, page, limit: 100 });
        if (!res.success) throw new Error(res.error);
        records.push(...(res.data ?? []));
        if (page >= (res.pagination?.totalPages ?? 1)) break;
      }
      const slips: Payslip[] = [];
      for (const [i, r] of records.slice(0, MAX_STUBS).entries()) {
        setBusy({ kind, done: i, total: Math.min(records.length, MAX_STUBS) });
        const res = await adminSalary.payslip(scopeId, r.staff_id, r.month, r.year);
        if (res.success && res.data) slips.push(res.data);
      }
      if (slips.length === 0) return toast.error(f('err_no_payslips'));
      const title = `${f('page_title')} · ${monthLabel(t, month, year)}`;
      const html = buildPrintHtml({ title, pages: slips.map((p) => payslipPageHtml(p, t, money)), school: print.school, layout: print.layout, withHeader: true, reportLabel: title });
      if (kind === 'print') await printHtml(html);
      else await sharePdf(html, `payslips-${year}-${String(month).padStart(2, '0')}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : f('err_bulk'));
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <View className="gap-3 p-4">
      <Text variant="muted">{f('page_subtitle')}</Text>
      <MonthYearPicker
        month={month}
        year={year}
        onChange={(m, y) => {
          setMonth(m);
          setYear(y);
        }}
      />
      <View className="flex-row gap-2">
        <Button className="flex-1" variant="outline" onPress={() => printAll('pdf')} disabled={!!busy || total === 0 || !print.ready}>
          <Icon as={FileDown} className="size-4" />
          <Text>PDF</Text>
        </Button>
        <Button className="flex-1" onPress={() => printAll('print')} disabled={!!busy || total === 0 || !print.ready}>
          <Icon as={Printer} className="text-primary-foreground size-4" />
          <Text>{f('print_all', { count: total })}</Text>
        </Button>
      </View>
      {busy ? (
        <View className="gap-1">
          <Progress value={busy.total ? Math.round((busy.done / busy.total) * 100) : 0} />
          <Text className="text-muted-foreground text-xs">{busy.total ? `${busy.done} / ${busy.total}` : f('loading')}</Text>
        </View>
      ) : null}
      <Text className="font-semibold">{f('card_title', { month: t(`common.months.${month - 1}`), year })}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: f('page_title') }} />
      <View className="bg-background flex-1">
        <DataList
          header={header}
          items={list.data ? list.items : undefined}
          error={list.error}
          isLoading={list.isLoading}
          isRefreshing={list.isValidating && !list.isLoading && list.size === 1}
          onRefresh={() => list.mutate()}
          onEndReached={list.loadMore}
          loadingMore={list.isValidating && list.size > 1}
          emptyTitle={f('no_records', { month: t(`common.months.${month - 1}`), year })}
          emptyBody={f('no_records_hint')}
          keyExtractor={(r) => r.id}
          renderItem={(r) => (
            <Pressable
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/admin/salary/payslip', params: { staffId: r.staff_id, month: String(r.month), year: String(r.year) } })}>
              <View className="flex-1">
                <Text className="text-sm font-semibold">{staffName(r)}</Text>
                <Text className="text-muted-foreground text-xs">{[r.staff?.employee_number, r.staff?.department, `${f('col_net_payable')}: ${money(r.net_salary)}`].filter(Boolean).join(' · ')}</Text>
              </View>
              <Badge variant={SALARY_STATUS_VARIANT[r.status]}>
                <Text>{t(`common.${r.status}`)}</Text>
              </Badge>
            </Pressable>
          )}
        />
      </View>
    </>
  );
}
