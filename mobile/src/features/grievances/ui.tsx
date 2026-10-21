import type { Grievance, GrievancePriority, GrievanceStatus } from '@studently/api-client';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { colors as themeColors } from '@/lib/colors';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const STATUS_KEYS: GrievanceStatus[] = ['submitted', 'pending_review', 'assigned', 'under_investigation', 'awaiting_info', 'resolved', 'closed', 'reopened', 'escalated', 'rejected'];
export const PRIORITIES: GrievancePriority[] = ['low', 'normal', 'high', 'urgent', 'critical'];

const STATUS_CLS: Record<GrievanceStatus, [string, string]> = {
  submitted: ['bg-info-soft', 'text-brand dark:text-brand-secondary'],
  pending_review: ['bg-warning-soft', 'text-warning'],
  assigned: ['bg-chart-6/10', 'text-chart-6'],
  under_investigation: ['bg-chart-6/10', 'text-chart-6'],
  awaiting_info: ['bg-warning-soft', 'text-warning'],
  resolved: ['bg-success-soft', 'text-success'],
  closed: ['bg-muted', 'text-muted-foreground'],
  reopened: ['bg-warning-soft', 'text-warning'],
  escalated: ['bg-destructive-soft', 'text-destructive'],
  rejected: ['bg-muted', 'text-muted-foreground'],
};

const PRIORITY_CLS: Record<string, [string, string]> = {
  low: ['bg-muted', 'text-muted-foreground'],
  normal: ['bg-info-soft', 'text-brand dark:text-brand-secondary'],
  high: ['bg-warning-soft', 'text-warning'],
  urgent: ['bg-warning-soft', 'text-warning'],
  critical: ['bg-destructive-soft', 'text-destructive'],
};

/** Hex colors used by the web's priority pie chart. */
export const PRIORITY_HEX: Record<string, string> = { low: themeColors.printMuted, normal: themeColors.brandSecondary, high: themeColors.brandAccent, urgent: themeColors.warning, critical: themeColors.destructive };

export const isOverdue = (g: Pick<Grievance, 'due_date' | 'status'>) => !!g.due_date && new Date(g.due_date) < new Date() && !['resolved', 'closed', 'rejected'].includes(g.status);

function Pill({ cls, label }: { cls: [string, string]; label: string }) {
  return (
    <View className={cn('rounded-full px-2.5 py-1', cls[0])}>
      <Text className={cn('text-[11px] font-semibold', cls[1])}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: GrievanceStatus }) {
  const { t } = useTranslation();
  return <Pill cls={STATUS_CLS[status] ?? STATUS_CLS.closed} label={t(`grievances.status.${status}`)} />;
}

export function PriorityPill({ priority }: { priority: GrievancePriority }) {
  const { t } = useTranslation();
  return <Pill cls={PRIORITY_CLS[priority] ?? PRIORITY_CLS.normal} label={t(`grievances.priority.${priority}`)} />;
}

export function OutlinePill({ label }: { label: string }) {
  return (
    <View className="bg-muted rounded-full px-2.5 py-1">
      <Text className="text-muted-foreground text-[11px] font-semibold">{label}</Text>
    </View>
  );
}

export function OverduePill() {
  const { t } = useTranslation();
  return (
    <View className="bg-destructive-soft flex-row items-center gap-1 rounded-full px-2.5 py-1">
      <Icon as={AlertTriangle} className="text-destructive size-3" />
      <Text className="text-destructive text-[11px] font-semibold">{t('grievances.list.overdue')}</Text>
    </View>
  );
}
