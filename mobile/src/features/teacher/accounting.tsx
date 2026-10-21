import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, CardContent } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { usePortalCurrency } from '@/features/portal/currency';
import { teacher } from '@/lib/api';
import { useApi } from '@/lib/data';
import { cn } from '@/lib/utils';

/** The signed-in staff member's salaries and payments with totals (web: teacher accounting pages). */
export function useOwnAccounting() {
  const salaries = useApi(['teacher', 'own-salaries'], () => teacher.ownSalaries());
  const payments = useApi(['teacher', 'own-payments'], () => teacher.ownPayments());
  const totalSalaries = (salaries.data ?? []).reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const totalPayments = (payments.data ?? []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  return { salaries, payments, totalSalaries, totalPayments, balance: totalSalaries - totalPayments };
}

/** Total salaries, total payments and the remaining balance (web: the three stat cards). */
export function OwnTotals({ totalSalaries, totalPayments, balance }: { totalSalaries: number; totalPayments: number; balance: number }) {
  const { t } = useTranslation();
  const k = (key: string) => t(`teacherPortal.accounting.totals.${key}`);
  const { money } = usePortalCurrency();
  const cell = (label: string, value: string, tone?: string) => (
    <Card className="min-w-[45%] flex-1">
      <CardContent className="gap-1 p-4">
        <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
        <Text className={cn('text-xl font-bold', tone)}>{value}</Text>
      </CardContent>
    </Card>
  );
  return (
    <View className="flex-row flex-wrap gap-2">
      {cell(k('total_salaries'), money(totalSalaries))}
      {cell(k('less_total_payments'), money(totalPayments), 'text-success')}
      {cell(k('balance'), money(balance), 'text-chart-6')}
    </View>
  );
}
