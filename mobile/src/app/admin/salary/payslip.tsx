import { Stack, useLocalSearchParams } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { ErrorState, LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { SALARY_STATUS_VARIANT, monthLabel, payslipPageHtml, payslipRows, staffName } from '@/features/admin/salary';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminSalary } from '@/lib/api';
import { useApi } from '@/lib/data';
import { buildPrintHtml, printHtml, sharePdf } from '@/lib/print';

/** One staff member's pay stub for a month, with print / PDF (web: payslip dialog on /admin/salary). */
export default function PayslipScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const params = useLocalSearchParams<{ staffId: string; month: string; year: string }>();
  const { scopeId } = useCampus();
  const { money } = useCurrency();
  const print = usePrintContext();
  const [busy, setBusy] = useState<'print' | 'pdf' | null>(null);
  const slip = useApi(scopeId ? ['admin', 'payslip', scopeId, params.staffId, Number(params.month), Number(params.year)] : null, ([, , sid, staffId, m, y]) =>
    adminSalary.payslip(sid as string, staffId as string, m as number, y as number),
  );

  if (slip.isLoading) return <LoadingList rows={6} />;
  if (slip.error || !slip.data) return <ErrorState message={slip.error?.message ?? t('admin.salary.page.toast.payslip_error')} onRetry={() => slip.mutate()} />;
  const p = slip.data;
  const { earnings, deductions, totalEarnings, totalDeductions, net } = payslipRows(p, t);
  const name = staffName(p);
  const period = monthLabel(t, p.month, p.year);

  async function run(kind: 'print' | 'pdf') {
    setBusy(kind);
    try {
      const html = buildPrintHtml({ title: name, pages: [payslipPageHtml(p, t, money)], school: print.school, layout: print.layout, withHeader: true, reportLabel: t('financial_statements.page_title') });
      if (kind === 'print') await printHtml(html);
      else await sharePdf(html, `payslip-${p.staff?.employee_number ?? p.staff_id.slice(0, 8)}-${p.year}-${String(p.month).padStart(2, '0')}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('app.error_title'));
    } finally {
      setBusy(null);
    }
  }

  const section = (title: string, rows: typeof earnings, total: number, tone: string, empty?: string) => (
    <Card className="gap-0 py-0">
      <Text className={`px-4 pt-3 pb-2 text-xs font-semibold ${tone}`}>{title}</Text>
      {rows.length === 0 && empty ? <Text className="text-muted-foreground px-4 pb-3 text-sm">{empty}</Text> : null}
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} className={`flex-row justify-between gap-3 px-4 py-1.5 ${r.sub ? 'ps-8' : ''}`}>
          <Text className={r.sub ? 'text-muted-foreground flex-1 text-xs' : 'flex-1 text-sm'}>{r.label}</Text>
          <Text className={r.sub ? 'text-muted-foreground text-xs' : 'text-sm'}>{money(r.amount)}</Text>
        </View>
      ))}
      <Separator className="mt-1" />
      <View className="flex-row justify-between px-4 py-3">
        <Text className="font-semibold">{t('payslip.label_total')}</Text>
        <Text className={`font-semibold ${tone}`}>{money(total)}</Text>
      </View>
    </Card>
  );

  return (
    <>
      <Stack.Screen options={{ title: name }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={slip.isValidating} onRefresh={() => slip.mutate()} />}>
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-semibold">{period}</Text>
            <Text variant="muted">{[p.staff?.employee_number, p.staff?.title ?? p.staff?.designation, p.staff?.department].filter(Boolean).join(' · ')}</Text>
          </View>
          <Badge variant={SALARY_STATUS_VARIANT[p.status]}>
            <Text>{t(`common.${p.status}`)}</Text>
          </Badge>
        </View>
        {section(t('payslip.label_earnings'), earnings, totalEarnings, 'text-success')}
        {section(t('payslip.label_deductions'), deductions, totalDeductions, 'text-destructive', t('payslip.label_no_deductions'))}
        <Card className="py-3">
          <CardContent className="flex-row items-center justify-between px-4">
            <Text className="font-bold">{t('payslip.label_net_salary')}</Text>
            <Text className="text-lg font-bold">{money(net)}</Text>
          </CardContent>
        </Card>
        <View className="flex-row gap-2">
          <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={!!busy || !print.ready}>
            <Icon as={FileDown} className="size-4" />
            <Text>{busy === 'pdf' ? t('app.ar_running') : 'PDF'}</Text>
          </Button>
          <Button className="flex-1" onPress={() => run('print')} disabled={!!busy || !print.ready}>
            <Icon as={Printer} className="text-primary-foreground size-4" />
            <Text>{t('school.students.print_info.print')}</Text>
          </Button>
        </View>
      </ScrollView>
    </>
  );
}
