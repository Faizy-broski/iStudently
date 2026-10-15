import { CalendarClock, CalendarDays, CheckCircle2, Clock3, CreditCard, PieChart, Receipt, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { daysUntil, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

import { FeeDueDateBadge } from './fees';

export interface TimelineFee {
  id: string;
  fee_name: string;
  due_date: string | null | undefined;
  final_amount: number;
  amount_paid: number;
  balance: number;
  status: string;
  academic_year: string;
}

type Stage = 'paid' | 'current' | 'overdue' | 'upcoming';
const STAGE: Record<Stage, { ring: string; bg: string; text: string; icon: LucideIcon; badge: [string, string, string] }> = {
  paid: { ring: 'border-green-500', bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-600', icon: CheckCircle2, badge: ['bg-green-100 dark:bg-green-900/30', 'text-green-700', 'badge_paid'] },
  current: { ring: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600', icon: Clock3, badge: ['bg-amber-100 dark:bg-amber-900/30', 'text-amber-700', 'badge_due_soon'] },
  overdue: { ring: 'border-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600', icon: Clock3, badge: ['bg-red-100 dark:bg-red-900/30', 'text-red-700', 'badge_overdue'] },
  upcoming: { ring: 'border-border', bg: 'bg-muted/40', text: 'text-muted-foreground', icon: CalendarDays, badge: ['border border-border', 'text-muted-foreground', 'badge_upcoming'] },
};

/** Web FeePaymentTimeline: installments of an academic year as a timeline, totals and the next payment. */
export function FeePaymentTimeline({ fees, money, onPay }: { fees: TimelineFee[]; money: (n: number) => string; onPay: () => void }) {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.timeline.${key}`, o);
  const years = [...new Set(fees.map((f) => f.academic_year).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const nextUnpaid = fees.filter((f) => f.due_date && f.status !== 'paid').sort((a, b) => ((a.due_date as string) < (b.due_date as string) ? -1 : 1))[0];
  const defaultYear = nextUnpaid?.academic_year || years[0] || '';
  const [picked, setPicked] = useState('');
  const year = picked || defaultYear;
  const items = fees.filter((f) => f.academic_year === year && f.due_date).sort((a, b) => ((a.due_date as string) < (b.due_date as string) ? -1 : 1));
  const total = items.reduce((s, f) => s + (f.final_amount || 0), 0);
  const paid = items.reduce((s, f) => s + (f.amount_paid || 0), 0);
  const outstanding = Math.max(total - paid, 0);
  const pct = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
  const nextIndex = items.findIndex((f) => f.status !== 'paid');
  const next = nextIndex >= 0 ? items[nextIndex] : null;
  const stageOf = (f: TimelineFee, i: number): Stage => (f.status === 'paid' ? 'paid' : i !== nextIndex ? 'upcoming' : f.due_date && daysUntil(f.due_date) < 0 ? 'overdue' : 'current');
  const ordinal = (n: number) => (n >= 1 && n <= 5 ? k(`ordinal_${n}`) : k('ordinal_n', { n }));

  return (
    <View className="gap-4">
      <Card>
        <CardHeader className="gap-3">
          <View className="flex-row items-center gap-2">
            <Icon as={CalendarClock} className="size-5" />
            <CardTitle>{k('title')}</CardTitle>
          </View>
          <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
          <View className="flex-row items-center gap-3">
            {years.length > 1 ? (
              <View className="flex-1">
                <Picker value={year} onChange={setPicked} options={years.map((y) => ({ value: y, label: y }))} />
              </View>
            ) : (
              <View className="flex-1" />
            )}
            <View className="border-border items-end rounded-lg border px-3 py-1.5">
              <Text className="text-muted-foreground text-xs">{k('total_fee')}</Text>
              <Text className="text-lg font-bold">{money(total)}</Text>
            </View>
          </View>
        </CardHeader>
        <CardContent className="gap-5">
          <View className="border-border bg-muted/30 flex-row gap-3 rounded-lg border px-3 py-2">
            <Icon as={Receipt} className="text-muted-foreground mt-0.5 size-4" />
            <Text className="text-muted-foreground flex-1 text-sm">{k('info_banner')}</Text>
          </View>
          {items.length === 0 ? (
            <View className="items-center py-10">
              <Icon as={CalendarDays} className="text-muted-foreground mb-3 size-12" />
              <Text className="text-muted-foreground">{k('no_records')}</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-start px-1 pb-2">
              {items.map((f, i) => {
                const stage = stageOf(f, i);
                const st = STAGE[stage];
                return (
                  <View key={f.id} className="flex-row items-start">
                    <View className="w-36 items-center gap-2">
                      <View className={cn('rounded-full px-2 py-0.5', st.badge[0])}>
                        <Text className={cn('text-xs font-medium', st.badge[1])}>{k(st.badge[2])}</Text>
                      </View>
                      <View className={cn('size-24 items-center justify-center rounded-full border-4', st.ring, st.bg)}>
                        <View className={cn('border-background absolute -end-1 -top-1 size-7 items-center justify-center rounded-full border-2', st.bg)}>
                          <Icon as={st.icon} className={cn('size-4', st.text)} />
                        </View>
                        <Text className="text-lg font-bold">{ordinal(i + 1)}</Text>
                        <Text className="text-muted-foreground text-[11px]">{k('installment_word')}</Text>
                      </View>
                      <Text className="text-sm font-semibold">{money(f.final_amount)}</Text>
                      <Text className="text-muted-foreground text-center text-xs">{`${k('due_label')}: ${f.due_date ? formatDate(f.due_date) : '—'}`}</Text>
                      {stage === 'paid' ? (
                        <View className="rounded-full border border-green-300 bg-green-50 px-2 py-0.5 dark:bg-green-950/30">
                          <Text className="text-xs text-green-600">{k('payment_completed')}</Text>
                        </View>
                      ) : (
                        <FeeDueDateBadge dueDate={f.due_date} status={f.status} />
                      )}
                    </View>
                    {i < items.length - 1 ? (
                      <View className={cn('mt-[52px] w-12', stage === 'paid' ? 'h-1 rounded-full bg-green-400' : stage === 'overdue' ? 'border-t-2 border-dashed border-red-300' : 'border-border border-t-2 border-dashed')} />
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          )}
          {items.length ? (
            <View className="flex-row flex-wrap gap-2">
              <Tile icon={Wallet} label={k('total_fees')} value={money(total)} />
              <Tile icon={Receipt} label={k('paid_amount')} value={money(paid)} tone="text-green-600" />
              <Tile icon={Wallet} label={k('outstanding')} value={money(outstanding)} tone="text-red-600" />
              <Tile icon={PieChart} label={k('paid_pct')} value={`${pct.toFixed(1)}%`} tone="text-green-600" />
              <Tile icon={CalendarDays} label={k('total_installments')} value={k('installments_count', { count: items.length })} />
            </View>
          ) : null}
        </CardContent>
      </Card>
      {items.length ? (
        next ? (
          <>
            <Card>
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-center gap-2">
                  <Icon as={CalendarClock} className="size-4" />
                  <Text className="font-semibold">{k('next_payment_details')}</Text>
                </View>
                <View className="flex-row gap-3">
                  <Col label={k('col_installment')} value={`${ordinal(nextIndex + 1)} ${k('installment_word')}`} />
                  <Col label={k('col_due_date')} value={next.due_date ? formatDate(next.due_date) : '—'} />
                  <Col label={k('col_amount')} value={money(next.balance)} />
                </View>
              </CardContent>
            </Card>
            <Card className="bg-primary/5">
              <CardContent className="gap-3 p-4">
                <View className="flex-row items-center gap-3">
                  <Icon as={ShieldCheck} className="text-primary size-8" />
                  <Text className="text-muted-foreground flex-1 text-sm">{k('pay_now_hint')}</Text>
                </View>
                <Button onPress={onPay}>
                  <Icon as={CreditCard} className="text-primary-foreground size-4" />
                  <Text>{k('pay_now')}</Text>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CardContent className="flex-row items-center gap-3 p-4">
              <Icon as={CheckCircle2} className="size-8 text-green-600" />
              <View className="flex-1">
                <Text className="font-semibold text-green-900 dark:text-green-200">{k('all_paid_title')}</Text>
                <Text className="text-sm text-green-700 dark:text-green-300">{k('all_paid_desc')}</Text>
              </View>
            </CardContent>
          </Card>
        )
      ) : null}
    </View>
  );
}

function Tile({ icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return (
    <Card className="min-w-[45%] flex-1 py-3">
      <CardContent className="flex-row items-center gap-3 px-3">
        <View className="bg-primary/10 size-10 items-center justify-center rounded-full">
          <Icon as={icon} className="text-primary size-5" />
        </View>
        <View className="flex-1">
          <Text className="text-muted-foreground text-xs">{label}</Text>
          <Text className={cn('font-bold', tone)}>{value}</Text>
        </View>
      </CardContent>
    </Card>
  );
}

function Col({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-muted-foreground mb-1 text-xs">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}
