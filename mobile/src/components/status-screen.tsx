import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { Info, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import LogoShape from '@/assets/images/Vector.svg';
import { BrandGradient } from '@/components/app/brand-gradient';
import { IconTile, type Tone } from '@/components/app/layout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getLastSchoolName } from '@/features/splash/last-school';
import { useColors } from '@/lib/colors';

export interface StatusAction {
  label: string;
  onPress(): void;
  primary?: boolean;
}

const SHAPE_RATIO = 899 / 611; // Vector.svg height / width
const LOGO_RATIO = 126 / 141; // splash-logo.png height / width

/**
 * Full-screen state. `busy`: branded loader that continues the launch splash (gradient, logo with
 * pulse rings, animated dots). Otherwise a centred message (icon, title, body) with actions.
 */
export function StatusScreen({
  title,
  body,
  actions = [],
  busy,
  icon = Info,
  tone = 'brand',
  children,
}: {
  title?: string;
  body?: string;
  actions?: StatusAction[];
  busy?: boolean;
  icon?: LucideIcon;
  tone?: Tone;
  children?: ReactNode;
}) {
  if (busy) return <BrandLoader label={body ?? title} />;
  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-1 justify-center gap-8 px-6">
        <Animated.View entering={FadeInDown.duration(400)} className="items-center gap-4">
          <View className="bg-info-soft/60 rounded-full p-3">
            <IconTile icon={icon} tone={tone} size={64} round />
          </View>
          {title ? <Text className="text-center text-xl font-bold">{title}</Text> : null}
          {body ? <Text className="text-muted-foreground text-center text-sm leading-6">{body}</Text> : null}
          {children}
        </Animated.View>
        {actions.length ? (
          <Animated.View entering={FadeInDown.delay(120).duration(400)} className="gap-2.5">
            {actions.map((a) => (
              <Button key={a.label} size="lg" variant={a.primary ? 'default' : 'outline'} onPress={a.onPress}>
                <Text>{a.label}</Text>
              </Button>
            ))}
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function BrandLoader({ label }: { label?: string }) {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const [school] = useState(getLastSchoolName);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const breathe = useSharedValue(0);
  const d1 = useSharedValue(0);
  const d2 = useSharedValue(0);
  const d3 = useSharedValue(0);

  useEffect(() => {
    const pulse = { duration: 2200, easing: Easing.out(Easing.cubic) };
    ring1.set(withRepeat(withTiming(1, pulse), -1));
    ring2.set(withDelay(1100, withRepeat(withTiming(1, pulse), -1)));
    breathe.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
    const dot = (v: SharedValue<number>, delay: number) =>
      v.set(withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 360 }), withTiming(0, { duration: 360 }), withTiming(0, { duration: 360 })), -1)));
    dot(d1, 0);
    dot(d2, 180);
    dot(d3, 360);
  }, [ring1, ring2, breathe, d1, d2, d3]);

  const ringStyle = (v: SharedValue<number>) => () => {
    'worklet';
    return { opacity: 0.45 * (1 - v.value), transform: [{ scale: 1 + v.value * 0.9 }] };
  };
  const r1 = useAnimatedStyle(ringStyle(ring1));
  const r2 = useAnimatedStyle(ringStyle(ring2));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + breathe.value * 0.04 }] }));
  const dotStyle = (v: SharedValue<number>) => () => {
    'worklet';
    return { opacity: 0.4 + v.value * 0.6, transform: [{ translateY: -v.value * 5 }] };
  };
  const s1 = useAnimatedStyle(dotStyle(d1));
  const s2 = useAnimatedStyle(dotStyle(d2));
  const s3 = useAnimatedStyle(dotStyle(d3));

  const bgW = width * 1.55;
  const markW = 96;
  const ringSize = 150;
  return (
    <BrandGradient variant="primary" angle={160} style={StyleSheet.absoluteFill}>
      <StatusBar style="light" />
      <View style={{ position: 'absolute', left: (width - bgW) / 2 + width * 0.18, top: (height - bgW * SHAPE_RATIO) / 2, opacity: 0.14 }} pointerEvents="none">
        <LogoShape width={bgW} height={bgW * SHAPE_RATIO} color={c.gradient1Start} />
      </View>
      <SafeAreaView className="flex-1">
        <View className="flex-1 items-center justify-center px-8" accessibilityRole="progressbar" accessibilityLabel={label}>
          <View style={{ width: ringSize, height: ringSize }} className="items-center justify-center">
            <Animated.View style={[styles.ring, { width: ringSize, height: ringSize, borderColor: c.white }, r1]} />
            <Animated.View style={[styles.ring, { width: ringSize, height: ringSize, borderColor: c.white }, r2]} />
            <Animated.View style={markStyle}>
              <Image source={require('@/assets/images/splash-logo.png')} style={{ width: markW, height: markW * LOGO_RATIO }} contentFit="contain" accessibilityIgnoresInvertColors />
            </Animated.View>
          </View>
          <Animated.View entering={FadeIn.delay(150).duration(500)} className="mt-8 items-center gap-3">
            {label ? <Text className="text-center text-base font-semibold text-white">{label}</Text> : null}
            <View className="flex-row gap-1.5">
              {[s1, s2, s3].map((s, i) => (
                <Animated.View key={i} className="size-2 rounded-full bg-white" style={s} />
              ))}
            </View>
          </Animated.View>
        </View>
        {school ? (
          <Animated.View entering={FadeIn.delay(400)} className="items-center pb-10">
            <Text className="text-xs text-white opacity-60">{school}</Text>
          </Animated.View>
        ) : null}
      </SafeAreaView>
    </BrandGradient>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 2 },
});
