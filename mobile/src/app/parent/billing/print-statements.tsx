import { NoChild, useChild } from '@/features/parent/child';
import { PrintStatementsView } from '@/features/portal/print-statements';
import { parent } from '@/lib/api';
import { useApi } from '@/lib/data';

/** The selected child's billing statement, printable (web: /parent/billing/print-statements). */
export default function ParentPrintStatements() {
  const { child, childId } = useChild();
  const fees = useApi(childId ? ['parent', 'payment-history', childId] : null, ([, , id]) => parent.getPaymentHistory(id as string));
  if (!child) return <NoChild />;
  const payments = (fees.data ?? [])
    .flatMap((f) => (f.payments ?? []).map((p) => ({ ...p, fee_name: f.fee_name })))
    .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
  return <PrintStatementsView fees={fees} payments={{ data: payments, isLoading: fees.isLoading, error: fees.error, mutate: fees.mutate }} school={child.campus_name} showFee />;
}
