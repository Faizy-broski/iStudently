import { Stack } from 'expo-router';
import { FileDown, Printer } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { useSession } from '@/features/auth/session';
import { usePortalCurrency } from '@/features/portal/currency';
import { OwnTotals, useOwnAccounting } from '@/features/teacher/accounting';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, escapeHtml, printHtml, sharePdf } from '@/lib/print';
import { cn } from '@/lib/utils';

/** The teacher's ledger of salaries (debit) and payments (credit) with a running balance, printable (web: /teacher/accounting/print-statements). */
export default function TeacherPrintStatements() {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPages.accountingPrintStatements.${key}`);
  const toast = useToast();
  const ctx = usePrintContext();
  const { money } = usePortalCurrency();
  const { me } = useSession();
  const profile = me.status === 'ready' ? me.me.profile : null;
  const acc = useOwnAccounting();
  const [busy, setBusy] = useState(false);
  const txns = [
    ...(acc.salaries.data ?? []).map((s) => ({ id: s.id, type: 'salary' as const, date: s.assigned_date, title: s.title, comments: s.comments, amount: Number(s.amount) || 0 })),
    ...(acc.payments.data ?? []).map((p) => ({ id: p.id, type: 'payment' as const, date: (p.payment_date || p.date || '') as string, title: p.title, comments: p.comments, amount: Number(p.amount) || 0 })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const rows = txns.reduce<((typeof txns)[number] & { balance: number })[]>((acc, x) => {
    const prev = acc.length ? acc[acc.length - 1].balance : 0;
    acc.push({ ...x, balance: prev + (x.type === 'salary' ? x.amount : -x.amount) });
    return acc;
  }, []);
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  async function run(mode: 'print' | 'pdf') {
    setBusy(true);
    try {
      const cell = 'style="padding:10px;border-bottom:1px solid #e2e8f0"';
      const body = `<h1 style="font-size:26px;font-weight:300;margin:0">${escapeHtml(k('staffStatement'))}</h1><p style="color:#64748b">${escapeHtml(k('historicalLedger'))}</p>
        <p><b>${escapeHtml(k('staffMember'))}:</b> ${escapeHtml(name)} · <b>${escapeHtml(k('statementDate'))}:</b> ${escapeHtml(formatDate(new Date().toISOString()))}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px"><tr>${[k('colDate'), k('colDescription'), k('colComments'), k('colSalaryDebit'), k('colPaidCredit'), k('colBalance')].map((h) => `<th style="text-align:start;padding:10px;border-bottom:2px solid #ccc">${escapeHtml(h)}</th>`).join('')}</tr>
        ${rows.length ? rows.map((r) => `<tr><td ${cell}>${escapeHtml(r.date ? formatDate(r.date) : '')}</td><td ${cell}>${escapeHtml(`${r.type === 'salary' ? k('salaryGenerated') : k('paymentIssued')}: ${r.title || k('adjustment')}`)}</td><td ${cell}>${escapeHtml(r.comments ?? '')}</td><td ${cell}>${r.type === 'salary' ? escapeHtml(money(r.amount)) : ''}</td><td ${cell}>${r.type === 'payment' ? escapeHtml(money(r.amount)) : ''}</td><td ${cell}><b>${escapeHtml(money(r.balance))}</b></td></tr>`).join('') : `<tr><td colspan="6" style="padding:30px;text-align:center;color:#64748b">${escapeHtml(k('noTransactions'))}</td></tr>`}</table>
        <p style="margin-top:16px">${escapeHtml(k('totalSalariesDebit'))} <b>${escapeHtml(money(acc.totalSalaries))}</b><br/>${escapeHtml(k('totalPaymentsCredit'))} <b>${escapeHtml(money(acc.totalPayments))}</b><br/>${escapeHtml(k('totalDueBalance'))} <b>${escapeHtml(money(acc.balance))}</b></p>`;
      const html = buildPrintHtml({ title: k('staffStatement'), pages: [body], school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader, reportLabel: k('staffReport') });
      if (mode === 'print') await printHtml(html);
      else await sharePdf(html, `staff-statement-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(k('generatedSuccess'));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : k('generateFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: k('staffStatement') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([acc.salaries.mutate(), acc.payments.mutate()])} />}>
        <Text variant="muted">{k('historicalLedger')}</Text>
        <View className="flex-row gap-2">
          <Button className="flex-1" variant="outline" onPress={() => run('pdf')} disabled={busy}>
            <Icon as={FileDown} className="size-4" />
            <Text>PDF</Text>
          </Button>
          <Button className="flex-1" onPress={() => run('print')} disabled={busy}>
            <Icon as={Printer} className="text-primary-foreground size-4" />
            <Text>{t('common.print')}</Text>
          </Button>
        </View>
        <OwnTotals totalSalaries={acc.totalSalaries} totalPayments={acc.totalPayments} balance={acc.balance} />
        {acc.salaries.isLoading || acc.payments.isLoading ? (
          <LoadingList rows={4} />
        ) : !rows.length ? (
          <Text className="text-muted-foreground py-8 text-center">{k('noTransactions')}</Text>
        ) : (
          <Card>
            <CardContent className="px-4 py-1">
              {rows.map((r) => (
                <View key={`${r.type}-${r.id}`} className="border-border gap-0.5 border-b py-2.5 last:border-b-0">
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 text-sm font-medium">{`${r.type === 'salary' ? k('salaryGenerated') : k('paymentIssued')}: ${r.title || k('adjustment')}`}</Text>
                    <Text className={cn('text-sm font-semibold', r.type === 'salary' ? 'text-foreground' : 'text-emerald-600')}>{`${r.type === 'salary' ? '' : '−'}${money(r.amount)}`}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-muted-foreground text-xs">{r.date ? formatDate(r.date) : ''}</Text>
                    <Text className="text-muted-foreground text-xs">{`${k('colBalance')}: ${money(r.balance)}`}</Text>
                  </View>
                  {r.comments ? <Text className="text-muted-foreground text-xs">{r.comments}</Text> : null}
                </View>
              ))}
            </CardContent>
          </Card>
        )}
      </ScrollView>
    </>
  );
}
