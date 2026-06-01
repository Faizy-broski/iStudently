import useSWR from 'swr'
import { getSchoolSettings, PaymentMethodOption } from '@/lib/api/school-settings'

/**
 * Returns the campus-specific default payment method.
 * Falls back to school-wide setting, then to 'cash' when nothing is saved.
 *
 * Usage:
 *   const defaultPaymentMethod = useDefaultPaymentMethod(campusId)
 *   // e.g. 'cash' | 'online' | 'bank_deposit' | 'cheque'
 */
export function useDefaultPaymentMethod(campusId?: string | null): PaymentMethodOption {
  const cacheKey = campusId ? `school-settings-default:${campusId}` : 'school-settings-default'

  const { data } = useSWR(cacheKey, () => getSchoolSettings(campusId), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // cache for 1 minute — settings change rarely
  })

  return (data?.data?.default_payment_method as PaymentMethodOption) || 'cash'
}
