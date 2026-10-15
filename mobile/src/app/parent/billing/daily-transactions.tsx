import { NoChild, useChild } from '@/features/parent/child';
import { DailyTransactionsView } from '@/features/portal/daily-transactions';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The selected child's payments of one month, grouped by day (web: /parent/billing/daily-transactions). */
export default function ParentDailyTransactions() {
  const { childId } = useChild();
  const fees = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  if (!childId) return <NoChild />;
  const payments = (fees.data ?? []).flatMap((f) => (f.payments ?? []).map((p) => ({ ...p, fee_name: f.fee_name })));
  return <DailyTransactionsView data={{ data: payments, isLoading: fees.isLoading, error: fees.error, mutate: fees.mutate }} />;
}
