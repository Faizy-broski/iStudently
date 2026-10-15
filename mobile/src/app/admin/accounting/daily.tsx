import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ScrollView } from '@/components/app/keyboard';
import { DateField } from '@/components/app/date-field';
import { Picker } from '@/components/app/picker';
import { EmptyState, ErrorState, LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { useAcademicYear } from '@/features/admin/use-academic-year';
import { useCurrency } from '@/features/admin/use-currency';
import { useCampus } from '@/features/campus/campus';
import { adminAccounting } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Tx = { id: string; type: 'income' | 'expense' | 'staff_payment'; title: string; amount: number; date: string; detail?: string };

/**
 * Incomes, expenses and staff payments in a period, grouped by day with day subtotals and a period
 * summary (web: /admin/accounting/daily-transactions).
 */
export default function AccountingDaily() {
  const { t } = useTranslation();
  const d = (k: string, o?: Record<string, unknown>) => t(`admin.accounting.daily_transactions.${k}`, o);
  const { scopeId, campus } = useCampus();
  const { money } = useCurrency();
  const ay = useAcademicYear();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const ready = !!scopeId && !!ay.name;
  const k = [scopeId ?? '', ay.name ?? '', start, end];
  const range = { start_date: start || undefined, end_date: end || undefined };
  const incomes = useApi(ready ? ['admin', 'acc-entries', 'incomes', ...k] : null, ([, , , sid, y]) => adminAccounting.entries('incomes', sid as string, y as string, range));
  const expenses = useApi(ready ? ['admin', 'acc-entries', 'expenses', ...k] : null, ([, , , sid, y]) => adminAccounting.entries('expenses', sid as string, y as string, range));
  const staff = useApi(ready ? ['admin', 'acc-entries', 'staff-payments', ...k] : null, ([, , , sid, y]) => adminAccounting.entries('staff-payments', sid as string, y as string, range));
  const totals = useApi(ready ? ['admin', 'acc-totals', ...k] : null, ([, , sid, y]) => adminAccounting.totals(sid as string, y as string, range));
  const loading = incomes.isLoading || expenses.isLoading || staff.isLoading;
  const error = incomes.error || expenses.error || staff.error;

  const all: Tx[] = [
    ...(incomes.data ?? []).map((x) => ({ id: x.id, type: 'income' as const, title: x.title, amount: Number(x.amount), date: x.income_date ?? '', detail: x.category?.name })),
    ...(expenses.data ?? []).map((x) => ({ id: x.id, type: 'expense' as const, title: x.title, amount: Number(x.amount), date: x.payment_date ?? '', detail: x.category?.name })),
    ...(staff.data ?? []).map((x) => ({ id: x.id, type: 'staff_payment' as const, title: x.title, amount: Number(x.amount), date: x.payment_date ?? '', detail: x.staff ? `${x.staff.profiles.first_name} ${x.staff.profiles.last_name}` : undefined })),
  ];
  const byDate = new Map<string, Tx[]>();
  for (const tx of all) byDate.set(tx.date, [...(byDate.get(tx.date) ?? []), tx]);
  const days = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  const sum = (list: Tx[], type: Tx['type']) => list.filter((x) => x.type === type).reduce((s, x) => s + x.amount, 0);
  const tt = totals.data;

  const line = (label: string, value: number, tone: 'green' | 'red' | 'auto', bold?: boolean) => (
    <View className={cn('flex-row justify-between', bold && 'border-border border-t pt-1')}>
      <Text className={bold ? 'font-bold' : 'text-sm'}>{label}</Text>
      <Text className={cn(bold ? 'font-bold' : 'text-sm', tone === 'green' || (tone === 'auto' && value >= 0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>{money(value)}</Text>
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: d('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10">
        <Text variant="muted">{d('subtitle', { campus: campus?.name ?? '' })}</Text>
        <Picker value={ay.id} onChange={ay.pick} options={ay.options} />
        <Text className="text-sm font-medium">{d('period')}</Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <DateField value={start || null} onChange={(v) => setStart(v ?? '')} clearable />
          </View>
          <Text>{t('common.to')}</Text>
          <View className="flex-1">
            <DateField value={end || null} onChange={(v) => setEnd(v ?? '')} clearable />
          </View>
        </View>

        {loading ? <LoadingList rows={4} /> : null}
        {error ? <ErrorState message={error.message} onRetry={() => [incomes, expenses, staff].forEach((x) => x.mutate())} /> : null}
        {!loading && !error && days.length === 0 ? <EmptyState title={d('empty')} /> : null}
        {days.map((day) => {
          const list = byDate.get(day) ?? [];
          return (
            <Card key={day} className="gap-1 py-3">
              <CardHeader className="px-4">
                <CardTitle className="text-base">{day ? formatDate(day) : '—'}</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                {list.map((tx, i) => (
                  <View key={tx.id}>
                    {i > 0 ? <Separator /> : null}
                    <View className="flex-row items-start gap-2 py-2">
                      <View className="flex-1 gap-0.5">
                        <Badge variant={tx.type === 'income' ? 'default' : tx.type === 'expense' ? 'destructive' : 'secondary'} className="self-start">
                          <Text>{d(`type_${tx.type}`)}</Text>
                        </Badge>
                        <Text className="text-sm">{tx.title}</Text>
                        {tx.detail ? <Text className="text-muted-foreground text-xs">{tx.detail}</Text> : null}
                      </View>
                      <Text className={tx.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{money(tx.amount)}</Text>
                    </View>
                  </View>
                ))}
                <Text className="text-muted-foreground pt-1 text-xs">
                  {`${d('day_income')}: ${money(sum(list, 'income'))} | ${d('day_expenses')}: ${money(sum(list, 'expense'))} | ${d('day_staff')}: ${money(sum(list, 'staff_payment'))}`}
                </Text>
              </CardContent>
            </Card>
          );
        })}

        {tt ? (
          <Card className="gap-2 py-4">
            <CardHeader className="px-4">
              <CardTitle>{d('summary_title')}</CardTitle>
              <CardDescription>{d('summary_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="gap-1 px-4">
              {line(d('total_incomes'), tt.total_incomes, 'green')}
              {line(d('less_expenses'), tt.total_expenses, 'red')}
              {line(d('balance'), tt.balance, 'auto', true)}
              <View className="h-3" />
              {line(d('total_incomes'), tt.total_incomes, 'green')}
              {line(d('plus_student_payments'), tt.total_student_payments, 'green')}
              {line(d('less_expenses'), tt.total_expenses, 'red')}
              {line(d('plus_staff_payments'), tt.total_staff_payments, 'red')}
              {line(d('general_balance'), tt.general_balance, 'auto', true)}
            </CardContent>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
