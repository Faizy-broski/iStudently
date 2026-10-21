import type { Tabs } from 'expo-router';
import { Ellipsis } from 'lucide-react-native';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandGradient } from '@/components/app/brand-gradient';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useColors } from '@/lib/colors';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const SPRING = LinearTransition.springify().damping(18).stiffness(180);

/**
 * Floating pill tab bar (Figma "Nav") for every role: the active tab grows into a gradient pill
 * with its label, the others show only the icon, and "More" sits in a dotted circle at the end.
 */
export function PillTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const c = useColors();
  return (
    <View
      className="bg-background items-center px-4 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
      <View className="border-border bg-card flex-row items-center justify-between self-stretch rounded-full border p-1.5">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const isMore = route.name === 'more';
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const icon = (color: string) => options.tabBarIcon?.({ focused, color, size: 22 });

          if (isMore && !focused) {
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                className="border-border size-12 items-center justify-center rounded-full border-2 border-dashed">
                <Icon as={Ellipsis} className="text-muted-foreground size-6" />
              </Pressable>
            );
          }

          return (
            // Open "More" becomes a gradient pill too, kept at the end of the bar.
            <Animated.View
              key={route.key}
              layout={SPRING}
              className={focused ? 'flex-shrink' : undefined}>
              <Pressable
                onPress={onPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                className={
                  focused
                    ? 'h-12 flex-row items-center justify-center overflow-hidden rounded-full px-4'
                    : 'size-12 items-center justify-center rounded-full'
                }>
                {focused ? (
                  <BrandGradient
                    variant="primary"
                    angle={90}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                ) : null}
                {isMore ? (
                  <Icon as={Ellipsis} size={22} color={c.white} />
                ) : (
                  icon(focused ? c.white : c.mutedForeground)
                )}
                {focused ? (
                  <Animated.View
                    entering={FadeIn.duration(180).delay(80)}
                    exiting={FadeOut.duration(80)}>
                    <Text className="text-white ms-2 text-sm font-semibold" numberOfLines={1}>
                      {label}
                    </Text>
                  </Animated.View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
