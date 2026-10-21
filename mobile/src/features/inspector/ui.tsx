import type { VisitStatus } from '@studently/api-client';
import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const VISIT_STATUS_TONE: Record<VisitStatus, string> = {
  scheduled: 'bg-warning-soft text-warning',
  confirmed: 'bg-info-soft text-brand dark:text-brand-secondary',
  in_progress: 'bg-chart-6/10 text-chart-6',
  completed: 'bg-success-soft text-success',
  cancelled: 'bg-destructive-soft text-destructive',
  rescheduled: 'bg-muted text-muted-foreground',
};

/** Round toggle chips (web: the teacher / campus pill buttons on observe, coaching, report and community). */
export function PillPicker<T extends string>({ items, value, onChange }: { items: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {items.map((it) => {
        const on = it.value === value;
        return (
          <Pressable
            key={it.value}
            onPress={() => onChange(it.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            className={cn('rounded-full border px-3 py-1.5', on ? 'border-brand bg-brand' : 'border-border bg-background')}>
            <Text className={cn('text-sm', on && 'text-white')}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
