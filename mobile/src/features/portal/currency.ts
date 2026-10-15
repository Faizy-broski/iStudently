import { formatNumber } from '@/lib/format';

import { usePortalSettings } from './menu';

/** The user's campus currency code (school_settings.default_currency) and a formatter. */
export function usePortalCurrency() {
  const settings = usePortalSettings();
  const raw = settings.data?.default_currency;
  const code = typeof raw === 'string' && raw.trim() ? raw.trim().split(' ')[0].toUpperCase() : '';
  const money = (amount: number | string | null | undefined) => {
    const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    return `${formatNumber(Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)}${code ? ` ${code}` : ''}`;
  };
  return { code, money };
}
