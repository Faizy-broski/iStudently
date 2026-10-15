import type { OwnSalary } from '@studently/api-client';
import { Stack } from 'expo-router';
import { HandCoins, Printer, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { SearchBar } from '@/components/app/search-bar';
import { LoadingList } from '@/components/app/states';
import { useToast } from '@/components/app/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { usePrintContext } from '@/features/admin/print-context';
import { payslipPageHtml } from '@/features/admin/salary';
import { usePortalCurrency } from '@/features/portal/currency';
import { OwnTotals, useOwnAccounting } from '@/features/teacher/accounting';
import { teacher } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { buildPrintHtml, printHtml } from '@/lib/print';

/** Assigned salaries with totals, a pay stub per salary, and a salary advance request (web: /teacher/accounting/salaries). */
export default function TeacherSalaries() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`teacherPortal.accounting.salaries.${key}`, o);
  const toast = useToast();
  const ctx = usePrintContext();
  const { money } = usePortalCurrency();
  const acc = useOwnAccounting();
  const [q, setQ] = useState('');
  const [printing, setPrinting] = useState<string | null>(null);
  const [advance, setAdvance] = useState<{ amount: string; reason: string } | null>(null);
  const [sending, setSending] = useState(false);
  const term = q.trim().toLowerCase();
  const list = (acc.salaries.data ?? []).filter((s) => !term || s.title?.toLowerCase().includes(term) || s.comments?.toLowerCase().includes(term));

  async function payStub(s: OwnSalary) {
    const d = new Date(s.assigned_date);
    setPrinting(s.id);
    try {
      const r = await teacher.myPayslip(d.getMonth() + 1, d.getFullYear());
      if (!r.success || !r.data) return toast.error(r.error || t('teacherPortal.accounting.payslips.print_error'));
      await printHtml(buildPrintHtml({ title: k('print_pay_stub'), pages: [payslipPageHtml(r.data, t, money)], school: ctx.school, layout: ctx.layout, withHeader: ctx.withHeader }));
    } catch (e) {
      toast.error(e instanceof Error && e.message === 'print-unavailable' ? t('app.pr_rebuild') : t('teacherPortal.accounting.payslips.print_error'));
    } finally {
      setPrinting(null);
    }
  }

  async function requestAdvance() {
    const amount = parseFloat(advance?.amount ?? '');
    if (!amount || amount <= 0) return toast.error(k('advance_amount_required'));
    setSending(true);
    const r = await teacher.requestAdvance({ amount, reason: advance?.reason.trim() || undefined });
    setSending(false);
    if (!r.success) return toast.error(r.error || k('advance_request_error'));
    toast.success(k('advance_requested'));
    setAdvance(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={() => Promise.all([acc.salaries.mutate(), acc.payments.mutate()])} />}>
        <Button className="self-start bg-[#022172]" onPress={() => setAdvance({ amount: '', reason: '' })}>
          <Icon as={HandCoins} className="size-4 text-white" />
          <Text className="text-white">{k('request_advance')}</Text>
        </Button>
        <OwnTotals totalSalaries={acc.totalSalaries} totalPayments={acc.totalPayments} balance={acc.balance} />
        <SearchBar value={q} onChangeText={setQ} placeholder={t('common.search')} />
        <Text className="text-muted-foreground text-sm">{k('found_count', { count: list.length })}</Text>
        {acc.salaries.isLoading ? (
          <LoadingList rows={4} />
        ) : !list.length ? (
          <Card>
            <CardContent className="items-center py-10">
              <Icon as={Wallet} className="text-muted-foreground/50 mb-2 size-8" />
              <Text className="font-medium">{k('no_salaries')}</Text>
            </CardContent>
          </Card>
        ) : (
          list.map((s) => (
            <Card key={s.id}>
              <CardContent className="gap-1.5 p-4">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 font-medium">{s.title || k('col_salary')}</Text>
                  <Text className="font-semibold text-[#022172] dark:text-[#57A3CC]">{money(Number(s.amount))}</Text>
                </View>
                <Text className="text-muted-foreground text-xs">{`${k('col_assigned')}: ${formatDate(s.assigned_date)} · ${k('col_due')}: ${s.due_date ? formatDate(s.due_date) : '-'}`}</Text>
                {s.comments ? <Text className="text-muted-foreground text-sm">{s.comments}</Text> : null}
                <View className="flex-row items-center justify-between">
                  {s.file_attached ? (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50">
                      <Text className="text-xs text-blue-700">{`${k('col_file_attached')}: ${t('common.yes')}`}</Text>
                    </Badge>
                  ) : (
                    <View />
                  )}
                  <Pressable onPress={() => payStub(s)} disabled={printing === s.id} hitSlop={8} accessibilityRole="button" className="flex-row items-center gap-1">
                    <Icon as={Printer} className="size-4 text-[#022172] dark:text-[#57A3CC]" />
                    <Text className="text-sm text-[#022172] dark:text-[#57A3CC]">{k('print_pay_stub')}</Text>
                  </Pressable>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
      <Dialog open={!!advance} onOpenChange={(v) => !v && setAdvance(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{k('request_advance_title')}</DialogTitle>
          </DialogHeader>
          {advance ? (
            <View className="gap-3">
              <View className="gap-1.5">
                <Label>{k('advance_amount')}</Label>
                <Input value={advance.amount} onChangeText={(v) => setAdvance({ ...advance, amount: v })} keyboardType="decimal-pad" />
              </View>
              <View className="gap-1.5">
                <Label>{k('advance_reason')}</Label>
                <Input value={advance.reason} onChangeText={(v) => setAdvance({ ...advance, reason: v })} />
              </View>
              <View className="flex-row justify-end gap-2">
                <Button variant="outline" onPress={() => setAdvance(null)}>
                  <Text>{t('common.cancel')}</Text>
                </Button>
                <Button onPress={requestAdvance} disabled={sending}>
                  <Text>{k('request_advance')}</Text>
                </Button>
              </View>
            </View>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
