import type { EscalationStage, PerformanceAction, StaffPerformanceLog } from '@studently/api-client';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const ESCALATIONS: EscalationStage[] = ['none', 'verbal_alert', 'written_warning', 'final_warning'];
const ESCALATION_CLS: Record<string, [string, string]> = {
  none: ['bg-gray-100', 'text-gray-700'],
  verbal_alert: ['bg-yellow-100', 'text-yellow-700'],
  written_warning: ['bg-orange-100', 'text-orange-700'],
  final_warning: ['bg-red-100', 'text-red-800'],
};

export function EscalationPill({ stage }: { stage: string }) {
  const { t } = useTranslation();
  const [bg, fg] = ESCALATION_CLS[stage] ?? ESCALATION_CLS.none;
  return (
    <View className={cn('rounded-full px-2 py-0.5', bg)}>
      <Text className={cn('text-xs font-medium', fg)}>{t(`app.pe_esc_${stage}`)}</Text>
    </View>
  );
}

export function TypePill({ demerit }: { demerit: boolean }) {
  const { t } = useTranslation();
  return (
    <View className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', demerit ? 'bg-red-100' : 'bg-green-100')}>
      <Icon as={demerit ? TrendingDown : TrendingUp} className={cn('size-3', demerit ? 'text-red-800' : 'text-green-800')} />
      <Text className={cn('text-xs font-medium', demerit ? 'text-red-800' : 'text-green-800')}>{demerit ? t('app.pe_violation') : t('app.pe_reward')}</Text>
    </View>
  );
}

export const actionName = (a: Pick<PerformanceAction, 'action_name_ar' | 'action_name_en'> | undefined, locale: string) => (a ? (locale === 'ar' ? a.action_name_ar : a.action_name_en) : '-');

export function logStaffName(log: StaffPerformanceLog) {
  const p = log.staff?.profiles;
  return (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '') || log.staff?.employee_number || log.staff_id;
}

export const effectivePoints = (log: StaffPerformanceLog) => log.custom_points ?? log.action?.default_points ?? 0;
export const effectiveFine = (log: StaffPerformanceLog) => log.custom_fine ?? log.action?.default_fine ?? 0;
