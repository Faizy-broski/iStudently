import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export type ChipTone = 'success' | 'warning' | 'destructive' | 'info' | 'muted';

const TONES: Record<ChipTone, [string, string]> = {
  success: ['bg-success-soft', 'text-success'],
  warning: ['bg-warning-soft', 'text-warning'],
  destructive: ['bg-destructive-soft', 'text-destructive'],
  info: ['bg-info-soft', 'text-brand dark:text-brand-secondary'],
  muted: ['bg-muted', 'text-muted-foreground'],
};

/** Soft status pill (Paid, Overdue, Trial …). */
export function StatusChip({ label, tone, className }: { label: string; tone: ChipTone; className?: string }) {
  const [bg, fg] = TONES[tone];
  return (
    <View className={cn('rounded-full px-2.5 py-1', bg, className)}>
      <Text className={cn('text-[11px] font-semibold', fg)}>{label}</Text>
    </View>
  );
}
