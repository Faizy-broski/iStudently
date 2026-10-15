import type { VisitStatus } from '@studently/api-client';
import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

export const VISIT_STATUS_TONE: Record<VisitStatus, string> = {
  scheduled: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-gray-100 text-gray-600',
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
            className={cn('rounded-full border px-3 py-1.5', on ? 'border-[#022172] bg-[#022172]' : 'border-border bg-background')}>
            <Text className={cn('text-sm', on && 'text-white')}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
