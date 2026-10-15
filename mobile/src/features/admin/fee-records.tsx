import type { FeeAdjustment, FeeAdjustmentType, StudentFeeStatus } from '@studently/api-client';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Status badge with the web's colours and labels (admin.fees.page). */
export function FeeStatusBadge({ status }: { status: StudentFeeStatus | string }) {
  const { t } = useTranslation();
  const variant = status === 'paid' ? 'default' : status === 'overdue' ? 'destructive' : status === 'partial' ? 'outline' : 'secondary';
  const label =
    status === 'pending' ? t('common.pending') : status === 'paid' ? t('common.paid') : ['partial', 'overdue', 'waived'].includes(status) ? t(`admin.fees.page.status.${status}`) : status;
  return (
    <Badge variant={variant}>
      <Text>{label}</Text>
    </Badge>
  );
}

/** Days left / due today / days overdue, from the due date (web: FeeDueDateBadge); nothing for paid fees. */
export function DueDateBadge({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const { t } = useTranslation();
  if (status === 'paid' || !dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.slice(0, 10).split('-').map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const tone = diff > 0 ? 'green' : diff === 0 ? 'yellow' : 'red';
  const text = diff > 0 ? t('app.fr_days_left', { count: diff }) : diff === 0 ? t('app.fr_due_today') : t('app.fr_days_overdue', { count: Math.abs(diff) });
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-full px-2 py-0.5',
        tone === 'green' && 'bg-green-100 dark:bg-green-900/30',
        tone === 'yellow' && 'bg-yellow-100 dark:bg-yellow-900/30',
        tone === 'red' && 'bg-red-100 dark:bg-red-900/30',
      )}>
      <View className={cn('size-1.5 rounded-full', tone === 'green' ? 'bg-green-500' : tone === 'yellow' ? 'bg-yellow-500' : 'bg-red-500')} />
      <Text
        className={cn(
          'text-xs font-semibold',
          tone === 'green' && 'text-green-700 dark:text-green-400',
          tone === 'yellow' && 'text-yellow-700 dark:text-yellow-400',
          tone === 'red' && 'text-red-700 dark:text-red-400',
        )}>
        {text}
      </Text>
    </View>
  );
}

export function adjustmentLabel(t: (k: string) => string, type: FeeAdjustmentType | string) {
  return ['late_fee_removed', 'late_fee_reduced', 'custom_discount', 'fee_waived', 'discount_restored'].includes(type) ? t(`app.fr_adj_${type}`) : type;
}

/** One adjustment in a fee's history (amount, reason, date, before/after, who). */
export function AdjustmentRow({ adj, money, showBeforeAfter }: { adj: FeeAdjustment; money: (n: number) => string; showBeforeAfter?: boolean }) {
  const { t } = useTranslation();
  const negative = adj.adjustment_amount < 0;
  return (
    <View className="border-border bg-card gap-1 rounded-lg border p-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-sm font-medium">{adjustmentLabel(t, adj.adjustment_type)}</Text>
          <Text className="text-muted-foreground text-xs">{adj.reason}</Text>
        </View>
        <View className="items-end">
          <Text className={cn('text-sm font-semibold', negative ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {`${negative ? '-' : '+'}${money(Math.abs(adj.adjustment_amount))}`}
          </Text>
          <Text className="text-muted-foreground text-xs">{formatDate(adj.created_at)}</Text>
        </View>
      </View>
      {showBeforeAfter ? (
        <View className="border-border flex-row justify-between border-t pt-1">
          <Text className="text-muted-foreground text-xs">{t('app.fr_before', { amount: money(adj.amount_before) })}</Text>
          <Text className="text-muted-foreground text-xs">{t('app.fr_after', { amount: money(adj.amount_after) })}</Text>
        </View>
      ) : null}
      {adj.adjusted_by_profile ? (
        <Text className="text-muted-foreground text-xs">{t('app.fr_by', { name: `${adj.adjusted_by_profile.first_name} ${adj.adjusted_by_profile.last_name}` })}</Text>
      ) : null}
    </View>
  );
}
