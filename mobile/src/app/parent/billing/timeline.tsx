import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { LoadingList } from '@/components/app/states';
import { Text } from '@/components/ui/text';
import { NoChild, useChild } from '@/features/parent/child';
import { usePortalCurrency } from '@/features/portal/currency';
import { FeePaymentTimeline } from '@/features/portal/fee-timeline';
import { PortalError } from '@/features/portal/ui';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** Installment timeline of the selected child's fees (web: /parent/billing/timeline). */
export default function ParentFeeTimeline() {
  const { t } = useTranslation();
  const { money } = usePortalCurrency();
  const { childId } = useChild();
  const fees = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  if (!childId) return <NoChild />;
  if (fees.isLoading) return <LoadingList rows={5} />;
  if (fees.error) return <PortalError title={t('student_billing.timeline.error_loading')} message={fees.error.message} />;
  return (
    <>
      <Stack.Screen options={{ title: t('student_billing.timeline.page_title') }} />
      <ScrollView className="bg-background flex-1" contentContainerClassName="gap-3 p-4 pb-10" refreshControl={<RefreshControl refreshing={false} onRefresh={() => fees.mutate()} />}>
        <Text variant="muted">{t('student_billing.timeline.page_subtitle')}</Text>
        <FeePaymentTimeline fees={fees.data ?? []} money={money} onPay={() => router.push('/parent/billing/fees')} />
      </ScrollView>
    </>
  );
}
