import { CalendarClock, CalendarDays, CheckCircle2, Clock3, CreditCard, PieChart, Receipt, ShieldCheck, Wallet, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Picker } from '@/components/app/picker';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/app/panel';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { daysUntil, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

import { FeeDueDateBadge } from './fees';
import { EmptyState } from '@/components/app/states';
import { HeroCard, IconTile, StatTile, StatTiles } from '@/components/app/layout';

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
  paid: { ring: 'border-success', bg: 'bg-success-soft ', text: 'text-success', icon: CheckCircle2, badge: ['bg-success-soft ', 'text-success', 'badge_paid'] },
  current: { ring: 'border-warning', bg: 'bg-warning-soft ', text: 'text-warning', icon: Clock3, badge: ['bg-warning-soft ', 'text-warning', 'badge_due_soon'] },
  overdue: { ring: 'border-destructive', bg: 'bg-destructive-soft ', text: 'text-destructive', icon: Clock3, badge: ['bg-destructive-soft ', 'text-destructive', 'badge_overdue'] },
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
      <Panel className="gap-4 p-4">
        <View className="gap-3">
          <View className="flex-row items-center gap-2.5">
            <IconTile icon={CalendarClock} size={32} />
            <View className="flex-1">
              <Text className="font-semibold">{k('title')}</Text>
              <Text variant="muted" className="text-xs">
                {k('subtitle')}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            {years.length > 1 ? (
              <View className="flex-1">
                <Picker value={year} onChange={setPicked} options={years.map((y) => ({ value: y, label: y }))} />
              </View>
            ) : (
              <View className="flex-1" />
            )}
            <View className="bg-info-soft items-end rounded-xl px-3 py-1.5">
              <Text className="text-muted-foreground text-[11px]">{k('total_fee')}</Text>
              <Text className="text-brand dark:text-foreground text-lg font-bold">{money(total)}</Text>
            </View>
          </View>
        </View>
        <View className="bg-muted/40 flex-row gap-3 rounded-xl px-3 py-2.5">
          <Icon as={Receipt} className="text-muted-foreground mt-0.5 size-4" />
          <Text className="text-muted-foreground flex-1 text-xs">{k('info_banner')}</Text>
        </View>
        {items.length === 0 ? (
          <EmptyState icon={CalendarDays} title={k('no_records')} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-start px-1 pb-2">
            {items.map((f, i) => {
              const stage = stageOf(f, i);
              const st = STAGE[stage];
              return (
                <View key={f.id} className="flex-row items-start">
                  <View className="w-36 items-center gap-2">
                    <View className={cn('rounded-full px-2.5 py-1', st.badge[0])}>
                      <Text className={cn('text-[11px] font-semibold', st.badge[1])}>{k(st.badge[2])}</Text>
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
                      <View className="bg-success-soft rounded-full px-2.5 py-1">
                        <Text className="text-success text-[11px] font-semibold">{k('payment_completed')}</Text>
                      </View>
                    ) : (
                      <FeeDueDateBadge dueDate={f.due_date} status={f.status} />
                    )}
                  </View>
                  {i < items.length - 1 ? (
                    <View className={cn('mt-[52px] w-12', stage === 'paid' ? 'h-1 rounded-full bg-success' : stage === 'overdue' ? 'border-t-2 border-dashed border-destructive' : 'border-border border-t-2 border-dashed')} />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
        {items.length ? (
          <StatTiles>
            <StatTile icon={Wallet} label={k('total_fees')} value={money(total)} />
            <StatTile icon={Receipt} label={k('paid_amount')} value={money(paid)} tone="success" />
            <StatTile icon={Wallet} label={k('outstanding')} value={money(outstanding)} tone="destructive" />
            <StatTile icon={PieChart} label={k('paid_pct')} value={`${pct.toFixed(1)}%`} tone="success" />
            <StatTile icon={CalendarDays} label={k('total_installments')} value={k('installments_count', { count: items.length })} />
          </StatTiles>
        ) : null}
      </Panel>
      {items.length ? (
        next ? (
          <>
            <Panel className="gap-3 p-4">
                <View className="flex-row items-center gap-2.5">
                  <IconTile icon={CalendarClock} tone="warning" size={32} />
                  <Text className="font-semibold">{k('next_payment_details')}</Text>
                </View>
                <View className="flex-row gap-3">
                  <Col label={k('col_installment')} value={`${ordinal(nextIndex + 1)} ${k('installment_word')}`} />
                  <Col label={k('col_due_date')} value={next.due_date ? formatDate(next.due_date) : '—'} />
                  <Col label={k('col_amount')} value={money(next.balance)} />
                </View>
            </Panel>
            <HeroCard>
                <View className="flex-row items-center gap-3">
                  <View className="size-11 items-center justify-center rounded-2xl bg-white/15">
                    <Icon as={ShieldCheck} className="size-6 text-white" />
                  </View>
                  <Text className="flex-1 text-sm text-white/90">{k('pay_now_hint')}</Text>
                </View>
                <Button variant="secondary" className="rounded-full" onPress={onPay}>
                  <Icon as={CreditCard} className="size-4" />
                  <Text>{k('pay_now')}</Text>
                </Button>
            </HeroCard>
          </>
        ) : (
          <View className="bg-success-soft flex-row items-center gap-3 rounded-2xl p-4">
            <IconTile icon={CheckCircle2} tone="success" size={44} round />
            <View className="flex-1">
              <Text className="text-success font-semibold">{k('all_paid_title')}</Text>
              <Text className="text-success text-sm">{k('all_paid_desc')}</Text>
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}

function Col({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1">
      <Text className="text-muted-foreground mb-1 text-xs">{label}</Text>
      <Text className="text-sm font-semibold">{value}</Text>
    </View>
  );
}
