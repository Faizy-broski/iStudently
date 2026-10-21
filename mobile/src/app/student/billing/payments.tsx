import { Stack } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { HeroCard, IconTile, Section } from '@/components/app/layout';
import { Panel } from '@/components/app/panel';
import { EmptyState, LoadingList } from '@/components/app/states';
import { StatusChip } from '@/components/app/status-chip';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePortalCurrency } from '@/features/portal/currency';
import { PortalError } from '@/features/portal/ui';
import { student } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatDate } from '@/lib/format';

/** The student's payment history with the total paid (web: /student/billing/payments). */
export default function StudentPayments() {
  const { t } = useTranslation();
  const k = (key: string, o?: Record<string, unknown>) => t(`student_billing.payments.${key}`, o);
  const { money } = usePortalCurrency();
  const data = useApi(['student', 'payments'], () => student.getStudentPaymentHistory());

  if (data.isLoading) return <LoadingList rows={6} />;
  if (data.error) return <PortalError title={k('error_loading')} message={data.error.message} />;
  const list = data.data ?? [];
  const total = list.reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <Stack.Screen options={{ title: k('title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-4 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text className="text-muted-foreground text-sm">{k('subtitle')}</Text>
        <HeroCard>
          <View className="flex-row items-center gap-3">
            <View className="size-11 items-center justify-center rounded-full bg-white/15">
              <Icon as={CreditCard} className="size-5 text-white" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white/85">{k('total_payments_made')}</Text>
              <Text className="text-3xl font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
                {money(total)}
              </Text>
            </View>
          </View>
          <View className="self-start rounded-full bg-white/15 px-3 py-1">
            <Text className="text-xs font-semibold text-white">{k('transactions_count', { count: list.length })}</Text>
          </View>
        </HeroCard>
        <Section title={k('payment_history')}>
          {list.length === 0 ? (
            <EmptyState icon={CreditCard} title={k('no_payments')} />
          ) : (
            <Panel>
              {list.map((p, i) => (
                <View key={p.id} className={i < list.length - 1 ? 'border-info-soft dark:border-border flex-row items-start gap-3 border-b px-4 py-3' : 'flex-row items-start gap-3 px-4 py-3'}>
                  <IconTile icon={CreditCard} tone="success" size={40} />
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center justify-between gap-2">
                      <Text className="text-sm font-semibold">{p.payment_date ? formatDate(p.payment_date) : '—'}</Text>
                      <Text className="text-success text-sm font-bold">{money(p.amount)}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs">{`${k('col_reference')}: ${p.payment_reference || '—'} · ${k('col_received_by')}: ${p.received_by || '—'}`}</Text>
                    <StatusChip label={p.payment_method || '—'} tone="muted" className="self-start" />
                  </View>
                </View>
              ))}
            </Panel>
          )}
        </Section>
      </ScrollView>
    </>
  );
}
