import { Pressable, ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/** Horizontal single-choice chips (status filters etc.): brand pill when active, soft card otherwise. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      style={{ flexGrow: 0 }}
      contentContainerClassName="items-center gap-2"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={cn('rounded-full border px-3.5 py-1.5', active ? 'bg-brand border-brand dark:bg-brand-secondary dark:border-brand-secondary' : 'border-info-soft dark:border-border bg-card')}>
            <Text className={cn('text-[13px] font-semibold', active ? 'text-white' : 'text-muted-foreground')}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Horizontal multi-choice chips (roles etc.). */
export function MultiChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="grow-0"
      style={{ flexGrow: 0 }}
      contentContainerClassName="items-center gap-2"
    >
      {options.map((o) => {
        const active = value.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            className={cn('rounded-full border px-3.5 py-1.5', active ? 'bg-brand border-brand dark:bg-brand-secondary dark:border-brand-secondary' : 'border-info-soft dark:border-border bg-card')}>
            <Text className={cn('text-[13px] font-semibold', active ? 'text-white' : 'text-muted-foreground')}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
