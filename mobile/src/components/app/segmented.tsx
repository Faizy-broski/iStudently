import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { raised } from '@/components/app/tile-grid';
import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/colors';
import { cn } from '@/lib/utils';

/** Pill segmented control (Invoices / Plans …): a white thumb slides to the selected segment. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width ? (width - 8) / options.length : 0;
  const thumb = useAnimatedStyle(() => ({ width: segment, transform: [{ translateX: withSpring(index * segment, { damping: 18, stiffness: 200 }) }] }), [index, segment]);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} className="bg-info-soft/70 dark:bg-muted h-11 flex-row rounded-full p-1">
      {width ? <Animated.View style={[{ position: 'absolute', top: 4, bottom: 4, start: 4, borderRadius: 999, backgroundColor: c.card }, raised(c.brand), thumb]} /> : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} className="flex-1 items-center justify-center" accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Text className={cn('text-sm font-semibold', active ? 'text-brand dark:text-foreground' : 'text-muted-foreground')}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
