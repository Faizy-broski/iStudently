import type { Grievance, GrievancePriority, GrievanceStatus } from '@studently/api-client';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const STATUS_KEYS: GrievanceStatus[] = ['submitted', 'pending_review', 'assigned', 'under_investigation', 'awaiting_info', 'resolved', 'closed', 'reopened', 'escalated', 'rejected'];
export const PRIORITIES: GrievancePriority[] = ['low', 'normal', 'high', 'urgent', 'critical'];

const STATUS_CLS: Record<GrievanceStatus, [string, string]> = {
  submitted: ['bg-blue-100', 'text-blue-800'],
  pending_review: ['bg-amber-100', 'text-amber-800'],
  assigned: ['bg-purple-100', 'text-purple-800'],
  under_investigation: ['bg-purple-100', 'text-purple-800'],
  awaiting_info: ['bg-amber-100', 'text-amber-800'],
  resolved: ['bg-green-100', 'text-green-800'],
  closed: ['bg-gray-100', 'text-gray-800'],
  reopened: ['bg-orange-100', 'text-orange-800'],
  escalated: ['bg-red-100', 'text-red-800'],
  rejected: ['bg-gray-100', 'text-gray-800'],
};

const PRIORITY_CLS: Record<string, [string, string]> = {
  low: ['bg-gray-100', 'text-gray-700'],
  normal: ['bg-blue-100', 'text-blue-700'],
  high: ['bg-amber-100', 'text-amber-700'],
  urgent: ['bg-orange-100', 'text-orange-700'],
  critical: ['bg-red-100', 'text-red-700'],
};

/** Hex colors used by the web's priority pie chart. */
export const PRIORITY_HEX: Record<string, string> = { low: '#94a3b8', normal: '#3b82f6', high: '#f59e0b', urgent: '#fb923c', critical: '#ef4444' };

export const isOverdue = (g: Pick<Grievance, 'due_date' | 'status'>) => !!g.due_date && new Date(g.due_date) < new Date() && !['resolved', 'closed', 'rejected'].includes(g.status);

function Pill({ cls, label }: { cls: [string, string]; label: string }) {
  return (
    <View className={cn('rounded-full px-2 py-0.5', cls[0])}>
      <Text className={cn('text-xs font-medium', cls[1])}>{label}</Text>
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
    <View className="border-border rounded-full border px-2 py-0.5">
      <Text className="text-xs">{label}</Text>
    </View>
  );
}

export function OverduePill() {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-red-100 px-2 py-0.5">
      <Icon as={AlertTriangle} className="size-3 text-red-800" />
      <Text className="text-xs font-medium text-red-800">{t('grievances.list.overdue')}</Text>
    </View>
  );
}
