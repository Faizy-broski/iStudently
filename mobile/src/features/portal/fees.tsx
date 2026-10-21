import { AlertTriangle, CheckCircle, ChevronRight, Clock, CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { IconTile } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
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
      ? ['bg-success-soft', 'bg-success', 'text-success', t('app.fee_days_remaining', { count: diff })]
      : diff === 0
        ? ['bg-warning-soft', 'bg-warning', 'text-warning', t('app.fee_due_today')]
        : ['bg-destructive-soft', 'bg-destructive', 'text-destructive', t('app.fee_days_overdue', { count: Math.abs(diff) })];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full px-2.5 py-1', box)}>
      <View className={cn('size-1.5 rounded-full', dot)} />
      <Text className={cn('text-[11px] font-semibold', text)}>{label}</Text>
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
      <View className="flex-row items-center gap-2.5">
        <IconTile icon={CreditCard} tone="warning" size={32} />
        <Text className="text-base font-semibold">{t('app.fw_title')}</Text>
      </View>
      {unpaid.length > 0 ? (
        <Pressable onPress={onViewAll} className="flex-row items-center gap-1 active:opacity-70" accessibilityRole="link">
          <Text className="text-brand dark:text-brand-secondary text-xs font-semibold">{t('app.fw_view_all')}</Text>
          <Icon flipRtl as={ChevronRight} className="text-brand dark:text-brand-secondary size-3" />
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Panel className="gap-3 p-4">
      {title}
      {isLoading ? (
        <>
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </>
      ) : fees.length === 0 || unpaid.length === 0 ? (
        <View className="items-center py-4">
          <Icon as={CheckCircle} className={cn('mb-2 size-10', fees.length === 0 ? 'text-muted-foreground' : 'text-success')} />
          <Text className={cn('text-sm font-semibold', fees.length === 0 ? 'text-muted-foreground' : 'text-success')}>
            {fees.length === 0 ? t('app.fw_no_invoices') : t('app.fw_all_paid')}
          </Text>
          <Text className="text-muted-foreground mt-1 text-xs">{t('app.fw_no_outstanding')}</Text>
        </View>
      ) : (
        <>
          <View className="bg-warning-soft flex-row items-center justify-between rounded-2xl p-3.5">
            <View>
              <Text className="text-xs font-semibold text-warning">{t('app.fw_total_outstanding')}</Text>
              <Text className="text-warning mt-0.5 text-2xl font-bold">{money(total)}</Text>
            </View>
            <View className="items-end gap-1">
              {overdue > 0 ? (
                <View className="bg-destructive-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
                  <Icon as={AlertTriangle} className="text-destructive size-3" />
                  <Text className="text-destructive text-[11px] font-semibold">{t('app.fw_overdue', { count: overdue })}</Text>
                </View>
              ) : null}
              {dueToday > 0 ? (
                <View className="bg-card flex-row items-center gap-1 rounded-full px-2.5 py-1">
                  <Icon as={Clock} className="text-warning size-3" />
                  <Text className="text-warning text-[11px] font-semibold">{t('app.fw_due_today_count', { count: dueToday })}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {sorted.slice(0, 4).map((f) => (
            <View key={f.id} className="border-info-soft dark:border-border flex-row items-center justify-between gap-3 rounded-xl border p-3">
              <View className="flex-1">
                <Text className="text-sm font-semibold" numberOfLines={1}>
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
              <Text className="text-brand dark:text-brand-secondary text-center text-xs font-semibold">{t('app.fw_more', { count: sorted.length - 4 })}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </Panel>
  );
}

const STATUS: Record<string, [string, string, string]> = {
  paid: ['bg-success-soft', 'text-success', 'status_paid'],
  partial: ['bg-warning-soft', 'text-warning', 'status_partial'],
  overdue: ['bg-destructive-soft', 'text-destructive', 'status_overdue'],
  waived: ['bg-info-soft', 'text-brand dark:text-brand-secondary', 'status_waived'],
};

/** Web statusBadge on the fees pages: paid / partial / overdue / waived / pending. */
export function FeeStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  const [box, text, key] = STATUS[status] ?? ['bg-warning-soft', 'text-warning', 'status_pending'];
  return (
    <View className={cn('self-start rounded-full px-2.5 py-1', box)}>
      <Text className={cn('text-[11px] font-semibold', text)}>{t(`student_billing.fees.${key}`)}</Text>
    </View>
  );
}
