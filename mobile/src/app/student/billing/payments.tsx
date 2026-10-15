import { Stack } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => data.mutate()} />}>
        <Text variant="muted">{k('subtitle')}</Text>
        <Card>
          <CardContent className="flex-row items-center gap-4 p-4">
            <Icon as={CreditCard} className="size-10 text-green-500" />
            <View>
              <Text className="text-muted-foreground text-sm">{k('total_payments_made')}</Text>
              <Text className="text-3xl font-bold text-green-600">{money(total)}</Text>
              <Text className="text-muted-foreground text-xs">{k('transactions_count', { count: list.length })}</Text>
            </View>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Icon as={CreditCard} className="size-5" />
            <CardTitle>{k('payment_history')}</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <View className="items-center py-10">
                <Icon as={CreditCard} className="text-muted-foreground mb-3 size-12" />
                <Text className="text-muted-foreground">{k('no_payments')}</Text>
              </View>
            ) : (
              list.map((p) => (
                <View key={p.id} className="border-border gap-1 border-t py-3 first:border-t-0">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-muted-foreground text-sm">{p.payment_date ? formatDate(p.payment_date) : '—'}</Text>
                    <Text className="font-semibold text-green-600">{money(p.amount)}</Text>
                  </View>
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      <Text className="text-xs">{p.payment_method || '—'}</Text>
                    </Badge>
                    <Text className="text-muted-foreground text-xs">{`${k('col_reference')}: ${p.payment_reference || '—'}`}</Text>
                    <Text className="text-muted-foreground text-xs">{`${k('col_received_by')}: ${p.received_by || '—'}`}</Text>
                  </View>
                </View>
              ))
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </>
  );
}
