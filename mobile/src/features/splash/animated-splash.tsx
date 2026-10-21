import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import LogoShape from '@/assets/images/Vector.svg';
import { BrandGradient } from '@/components/app/brand-gradient';
import { Text } from '@/components/ui/text';
import { getLastSchoolName } from '@/features/splash/last-school';
import { useColors } from '@/lib/colors';

const SHAPE_RATIO = 899 / 611; // Vector.svg height / width
const MIN_SHOW_MS = 1800;
const LOGO_RATIO = 126 / 141; // splash-logo.png height / width

/**
 * Launch screen (Figma "Splash"): brand gradient, the large logo shape faded in the background,
 * the logo mark on its white shape, name + tagline, a loading bar, and version · school.
 * Shown over the app until `ready`, then fades out and calls `onDone`.
 */
export function AnimatedSplash({ ready, onLayout, onDone }: { ready: boolean; onLayout?: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const [school] = useState(getLastSchoolName);
  const [minDone, setMinDone] = useState(false);
  const version = Constants.expoConfig?.version ?? '';

  // Entrance
  const bgShape = useSharedValue(0);
  const mark = useSharedValue(0);
  const text = useSharedValue(0);
  const tagline = useSharedValue(0);
  const progress = useSharedValue(0);
  const exit = useSharedValue(1);

  useEffect(() => {
    bgShape.set(withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    mark.set(withDelay(150, withSpring(1, { damping: 12, stiffness: 120 })));
    text.set(withDelay(450, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })));
    tagline.set(withDelay(650, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })));
    // Loading bar: runs to 70% while the app starts; the rest when it's ready.
    progress.set(withDelay(400, withTiming(0.7, { duration: 1300, easing: Easing.out(Easing.quad) })));
    const timer = setTimeout(() => setMinDone(true), MIN_SHOW_MS);
    return () => clearTimeout(timer);
  }, [bgShape, mark, text, tagline, progress]);

  useEffect(() => {
    if (!ready || !minDone) return;
    progress.set(withSequence(
      withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150 }),
    ));
    exit.set(withDelay(450, withTiming(0, { duration: 400 }, (finished) => finished && runOnJS(onDone)())));
  }, [ready, minDone, progress, exit, onDone]);

  const bgShapeStyle = useAnimatedStyle(() => ({
    opacity: bgShape.value * 0.14,
    transform: [{ scale: 1.15 - bgShape.value * 0.15 }, { rotate: `${(1 - bgShape.value) * -6}deg` }],
  }));
  const markStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, mark.value * 1.5), transform: [{ scale: 0.6 + mark.value * 0.4 }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 14 }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value, transform: [{ translateY: (1 - tagline.value) * 10 }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const exitStyle = useAnimatedStyle(() => ({ opacity: exit.value }));

  const bgW = width * 1.55;
  const markW = 112;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }, exitStyle]} onLayout={onLayout} pointerEvents={ready ? 'none' : 'auto'}>
      <StatusBar style="light" />
      <BrandGradient variant="primary" angle={160} style={StyleSheet.absoluteFill}>
        {/* Large faded logo shape behind everything */}
        <Animated.View style={[{ position: 'absolute', left: (width - bgW) / 2 + width * 0.18, top: (height - bgW * SHAPE_RATIO) / 2 }, bgShapeStyle]} pointerEvents="none">
          <LogoShape width={bgW} height={bgW * SHAPE_RATIO} color={c.gradient1Start} />
        </Animated.View>

        <View className="flex-1 items-center justify-center px-8">
          <Animated.View style={markStyle}>
            {/* Logo mark exported from Figma (white shape + glyph) */}
            <Image source={require('@/assets/images/splash-logo.png')} style={{ width: markW, height: markW * LOGO_RATIO }} contentFit="contain" accessibilityIgnoresInvertColors />
          </Animated.View>
          <Animated.View style={textStyle} className="mt-6">
            <Text className="text-white text-3xl font-bold">iStudently</Text>
          </Animated.View>
          <Animated.View style={taglineStyle} className="mt-2">
            <Text className="text-center text-sm text-white opacity-80">{t('app.splash_tagline')}</Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeIn.delay(500)} className="items-center gap-4 pb-16">
          <View className="bg-overlay-light h-1 w-24 overflow-hidden rounded-full">
            <Animated.View className="h-1 rounded-full bg-white" style={barStyle} />
          </View>
          <Text className="text-xs text-white opacity-60">{[version ? `v${version}` : null, school].filter(Boolean).join(' · ')}</Text>
        </Animated.View>
      </BrandGradient>
    </Animated.View>
  );
}
