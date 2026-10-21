import type { PlatformSchool } from '@studently/api-client';
import { useTranslation } from 'react-i18next';

import { StatusChip } from '@/components/app/status-chip';
import { Badge } from '@/components/ui/badge';
import { Text } from '@/components/ui/text';
import { daysUntil } from '@/lib/format';

/** Trial that hasn't ended yet. */
export function onTrial(s: Pick<PlatformSchool, 'is_trial' | 'trial_ends_at'>) {
  return !!s.is_trial && !!s.trial_ends_at && daysUntil(s.trial_ends_at) >= 0;
}

export function SchoolStatusBadge({ school }: { school: Pick<PlatformSchool, 'status' | 'is_trial' | 'trial_ends_at'> }) {
  const { t } = useTranslation();
  if (school.status === 'suspended')
    return (
      <Badge variant="destructive">
        <Text>{t('app.sa_status_suspended')}</Text>
      </Badge>
    );
  if (school.is_trial)
    return (
      <Badge variant="secondary">
        <Text>{onTrial(school) ? t('app.sa_status_trial') : t('app.sa_trial_ended')}</Text>
      </Badge>
    );
  return (
    <Badge>
      <Text>{t('app.sa_status_active')}</Text>
    </Badge>
  );
}

/** Soft chip version (card lists): Suspended red, Trial amber, Trial ended grey, Active green. */
export function SchoolStatusChip({ school }: { school: Pick<PlatformSchool, 'status' | 'is_trial' | 'trial_ends_at'> }) {
  const { t } = useTranslation();
  if (school.status === 'suspended') return <StatusChip label={t('app.sa_status_suspended')} tone="destructive" />;
  if (school.is_trial) return onTrial(school) ? <StatusChip label={t('app.sa_status_trial')} tone="warning" /> : <StatusChip label={t('app.sa_trial_ended')} tone="muted" />;
  return <StatusChip label={t('app.sa_status_active')} tone="success" />;
}
