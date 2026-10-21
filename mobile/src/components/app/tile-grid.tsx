import type { LucideIcon } from 'lucide-react-native';
import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/colors';
import { cn } from '@/lib/utils';

const GAP = 10;

/** Card surface style. Flat by design (no ): cards are separated by their soft border only. */
export const raised = (_color: string) => ({});

/** 3-column grid of tiles (Figma "More Menu"): equal widths, 10 px gaps. */
export function TileGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <View style={{ gap: GAP }}>
      {rows.map((row, r) => (
        <View key={r} className="flex-row" style={{ gap: GAP }}>
          {row}
          {row.length < 3
            ? Array.from({ length: 3 - row.length }, (_, i) => (
                <View key={`f${i}`} className="flex-1" />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

/** Soft tile (Figma): flat card fill, faint border, icon over a short label. `dot` marks website-only pages. */
export function Tile({
  icon,
  label,
  onPress,
  tone = 'brand',
  dot,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'brand' | 'destructive';
  dot?: boolean;
}) {
  const c = useColors();
  const toneClass =
    tone === 'destructive' ? 'text-destructive' : 'text-brand dark:text-brand-secondary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={raised(c.brand)}
      className="border-info-soft dark:border-border bg-card h-[88px] flex-1 items-center justify-center gap-2 rounded-2xl border px-1.5 active:opacity-80">
      <Icon as={icon} strokeWidth={2.2} className={cn('size-7', toneClass)} />
      <Text className={cn('text-center text-xs font-semibold', toneClass)} numberOfLines={2}>
        {label}
      </Text>
      {dot ? (
        <View className="bg-brand-accent absolute end-2.5 top-2.5 size-1.5 rounded-full" />
      ) : null}
    </Pressable>
  );
}
