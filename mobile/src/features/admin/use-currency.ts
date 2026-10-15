import { useCampus } from '@/features/campus/campus';
import { adminSchool } from '@/lib/api';
import { useApi } from '@/lib/data';
import { formatNumber } from '@/lib/format';

/** The campus currency (school_settings.default_currency, e.g. "LYD - Libyan Dinar") and a formatter. */
export function useCurrency() {
  const { campusId } = useCampus();
  const settings = useApi(['admin', 'school-settings', campusId ?? 'school'], () => adminSchool.getSettings(campusId));
  const raw = settings.data?.default_currency;
  const code = typeof raw === 'string' && raw.trim() ? raw.trim().split(' ')[0].toUpperCase() : '';
  const money = (amount: number | string | null | undefined) => {
    const n = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
    return `${formatNumber(Number.isFinite(n) ? Math.round(n * 100) / 100 : 0)}${code ? ` ${code}` : ''}`;
  };
  return { code, money };
}
