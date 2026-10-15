import { useSWRConfig } from 'swr'
import type { PaymentStatus } from '@studently/api-client'

/** Badge variant per invoice status. */
export const PAY_VARIANT: Record<PaymentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  pending: 'secondary',
  unpaid: 'outline',
  overdue: 'destructive',
}

/** Refresh every cached invoice list and the dashboard after a change. */
export function useRefreshBilling() {
  const { mutate } = useSWRConfig();
  return () =>
    mutate((key) => {
      const k = Array.isArray(key) ? key.join(':') : String(key);
      return k.includes('platform-records') || k.includes('records') || k.includes('summary');
    });
}
