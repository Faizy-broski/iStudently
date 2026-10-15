import { AlertTriangle, CheckCircle, ChevronRight, Clock, CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { daysUntil, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface WidgetFee {
  id: string;
  fee_name: string;
  due_date?: string | null;
  balance: number;
  final_amount: number;
  status: string;
}

/** Web FeeDueDateBadge: days remaining (green), due today (yellow) or days overdue (red); nothing when paid. */
export function FeeDueDateBadge({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const { t } = useTranslation();
  if (status === 'paid' || !dueDate) return null;
  const diff = daysUntil(dueDate);
  const [box, dot, text, label] =
    diff > 0
      ? ['border-green-200 bg-green-100 dark:border-green-900/50 dark:bg-green-900/30', 'bg-green-500', 'text-green-700 dark:text-green-400', t('app.fee_days_remaining', { count: diff })]
      : diff === 0
        ? ['border-yellow-200 bg-yellow-100 dark:border-yellow-900/50 dark:bg-yellow-900/30', 'bg-yellow-500', 'text-yellow-700 dark:text-yellow-400', t('app.fee_due_today')]
        : ['border-red-200 bg-red-100 dark:border-red-900/50 dark:bg-red-900/30', 'bg-red-500', 'text-red-700 dark:text-red-400', t('app.fee_days_overdue', { count: Math.abs(diff) })];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full border px-2.5 py-0.5', box)}>
      <View className={cn('size-1.5 rounded-full', dot)} />
      <Text className={cn('text-xs font-semibold', text)}>{label}</Text>
    </View>
  );
}

/** Web FinancialWidget: outstanding total, overdue / due-today counts and the 4 most urgent unpaid fees. */
export function FinancialWidget({ fees, isLoading, money, onViewAll }: { fees: WidgetFee[]; isLoading?: boolean; money: (n: number) => string; onViewAll: () => void }) {
  const { t } = useTranslation();
  const unpaid = fees.filter((f) => f.status !== 'paid' && f.balance > 0);
  const urgency = (f: WidgetFee) => (f.due_date ? daysUntil(f.due_date) : 9999);
  const sorted = [...unpaid].sort((a, b) => urgency(a) - urgency(b));
  const total = unpaid.reduce((s, f) => s + f.balance, 0);
  const overdue = unpaid.filter((f) => f.due_date && daysUntil(f.due_date) < 0).length;
  const dueToday = unpaid.filter((f) => f.due_date && daysUntil(f.due_date) === 0).length;

  const title = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <Icon as={CreditCard} className="size-4 text-orange-500" />
        <CardTitle className="text-base">{t('app.fw_title')}</CardTitle>
      </View>
      {unpaid.length > 0 ? (
        <Pressable onPress={onViewAll} className="flex-row items-center gap-1" accessibilityRole="link">
          <Text className="text-xs font-medium text-blue-600 dark:text-blue-400">{t('app.fw_view_all')}</Text>
          <Icon as={ChevronRight} className="size-3 text-blue-600 rtl:rotate-180 dark:text-blue-400" />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">{title}</CardHeader>
      <CardContent className="gap-3 px-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </>
        ) : fees.length === 0 || unpaid.length === 0 ? (
          <View className="items-center py-4">
            <Icon as={CheckCircle} className={cn('mb-2 size-10', fees.length === 0 ? 'text-muted-foreground' : 'text-green-500')} />
            <Text className={cn('text-sm font-semibold', fees.length === 0 ? 'text-muted-foreground' : 'text-green-700 dark:text-green-400')}>
              {fees.length === 0 ? t('app.fw_no_invoices') : t('app.fw_all_paid')}
            </Text>
            <Text className="text-muted-foreground mt-1 text-xs">{t('app.fw_no_outstanding')}</Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center justify-between rounded-xl border border-orange-100 bg-orange-50 p-3 dark:border-orange-900/50 dark:bg-orange-900/20">
              <View>
                <Text className="text-xs font-semibold text-orange-700 uppercase dark:text-orange-400">{t('app.fw_total_outstanding')}</Text>
                <Text className="mt-0.5 text-2xl font-bold text-orange-600 dark:text-orange-500">{money(total)}</Text>
              </View>
              <View className="items-end gap-1">
                {overdue > 0 ? (
                  <View className="flex-row items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 dark:border-red-900/50 dark:bg-red-900/20">
                    <Icon as={AlertTriangle} className="size-3 text-red-600" />
                    <Text className="text-xs font-semibold text-red-600 dark:text-red-400">{t('app.fw_overdue', { count: overdue })}</Text>
                  </View>
                ) : null}
                {dueToday > 0 ? (
                  <View className="flex-row items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 dark:border-yellow-900/50 dark:bg-yellow-900/20">
                    <Icon as={Clock} className="size-3 text-yellow-600" />
                    <Text className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">{t('app.fw_due_today_count', { count: dueToday })}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {sorted.slice(0, 4).map((f) => (
              <View key={f.id} className="border-border flex-row items-center justify-between gap-3 rounded-lg border p-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium" numberOfLines={1}>
                    {f.fee_name}
                  </Text>
                  {f.due_date ? <Text className="text-muted-foreground mt-0.5 text-xs">{t('app.fw_due', { date: formatDate(f.due_date) })}</Text> : null}
                </View>
                <View className="items-end gap-1">
                  <Text className="text-sm font-bold">{money(f.balance)}</Text>
                  <FeeDueDateBadge dueDate={f.due_date} status={f.status} />
                </View>
              </View>
            ))}
            {sorted.length > 4 ? (
              <Pressable onPress={onViewAll} accessibilityRole="link">
                <Text className="text-center text-xs font-medium text-blue-600 dark:text-blue-400">{t('app.fw_more', { count: sorted.length - 4 })}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS: Record<string, [string, string, string]> = {
  paid: ['bg-green-100', 'text-green-700', 'status_paid'],
  partial: ['bg-yellow-100', 'text-yellow-700', 'status_partial'],
  overdue: ['bg-red-100', 'text-red-700', 'status_overdue'],
  waived: ['bg-blue-100', 'text-blue-700', 'status_waived'],
};

/** Web statusBadge on the fees pages: paid / partial / overdue / waived / pending. */
export function FeeStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  const [box, text, key] = STATUS[status] ?? ['bg-orange-100', 'text-orange-700', 'status_pending'];
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', box)}>
      <Text className={cn('text-xs font-medium', text)}>{t(`student_billing.fees.${key}`)}</Text>
    </View>
  );
}
