import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { raised } from '@/components/app/tile-grid';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/colors';
import { cn } from '@/lib/utils';

// Building blocks for detail screens in the app's card style (raised soft cards, icon rows).

/** Raised soft card. */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={raised(c.brand)} className={cn('border-info-soft dark:border-border bg-card rounded-2xl border', className)}>
      {children}
    </View>
  );
}

/** Section title inside a panel, with an optional trailing element. */
export function PanelTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-1 pt-4">
      <Text className="text-base font-semibold">{title}</Text>
      {trailing}
    </View>
  );
}

/** Icon + label + value row; hidden when there's no value. Tappable when `onPress` is set. */
export function InfoRow({ icon, label, value, onPress, last }: { icon: LucideIcon; label: string; value?: string | null; onPress?: () => void; last?: boolean }) {
  if (!value) return null;
  const body = (
    <View className={cn('flex-row items-center gap-3 px-4 py-2.5', !last && 'border-info-soft dark:border-border border-b')}>
      <View className="bg-info-soft size-8 items-center justify-center rounded-full">
        <Icon as={icon} className="text-brand dark:text-brand-secondary size-4" />
      </View>
      <View className="flex-1">
        <Text variant="muted" className="text-[11px]">
          {label}
        </Text>
        <Text className="text-sm font-medium" selectable numberOfLines={2}>
          {value}
        </Text>
      </View>
      {onPress ? <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} className="active:opacity-70">
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Tappable row with an icon tile, title and chevron (actions inside a panel). */
export function ActionRow({ icon, title, subtitle, onPress, last, trailing }: { icon: LucideIcon; title: string; subtitle?: string | null; onPress: () => void; last?: boolean; trailing?: ReactNode }) {
  return (
    <Pressable onPress={onPress} className={cn('flex-row items-center gap-3 px-4 py-3 active:opacity-70', !last && 'border-info-soft dark:border-border border-b')}>
      <View className="bg-info-soft size-9 items-center justify-center rounded-xl">
        <Icon as={icon} strokeWidth={2.2} className="text-brand dark:text-brand-secondary size-4" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="muted" className="text-[11px]" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? <Icon as={ChevronRight} flipRtl className="text-muted-foreground size-4" />}
    </Pressable>
  );
}

/** Tappable raised row card for long lists (schools, invoices …). */
export function ListCard({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={raised(c.brand)} className="border-info-soft dark:border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 active:opacity-80">
      {children}
    </Pressable>
  );
}

/** FlatList props for card lists: 8 px gaps, side padding. */
export const CARD_LIST_PROPS = { ItemSeparatorComponent: () => <View className="h-2" />, contentContainerClassName: 'flex-grow px-4 pb-6' };
