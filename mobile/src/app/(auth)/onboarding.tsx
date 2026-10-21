import { Image, type ImageSource } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BrandGradient } from '@/components/app/brand-gradient';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { markOnboardingSeen } from '@/features/onboarding/seen';
import { useColors } from '@/lib/colors';

type Slide = { key: string; image?: ImageSource };

const AUTO_ADVANCE_MS = 4000;

// Photos: mobile/assets/images/onboarding-*.jpg (generated with Figma AI; replace with real school photos any time).
const SLIDES: Slide[] = [
  { key: 'learning', image: require('@/assets/images/onboarding-1.jpg') },
  { key: 'roles', image: require('@/assets/images/onboarding-2.jpg') },
  { key: 'connected', image: require('@/assets/images/onboarding-3.jpg') },
];

/** First-launch intro (Figma "Onboarding"): full-bleed photo, label, headline, text, dots, Continue. */
export default function Onboarding() {
  const { t } = useTranslation();
  const k = (key: string) => t(`app.onb_${key}`);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const list = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Auto-advance; restarts after every slide change, pauses while the user drags, stops on the last slide.
  useEffect(() => {
    if (dragging || index >= SLIDES.length - 1) return;
    const timer = setTimeout(() => {
      list.current?.scrollToIndex({ index: index + 1, animated: true });
      setIndex(index + 1);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [index, dragging]);

  function finish() {
    markOnboardingSeen();
    router.replace('/sign-in');
  }
  function next() {
    if (index >= SLIDES.length - 1) return finish();
    list.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  }

  return (
    <View className="bg-raw-black flex-1">
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1">
            {item.image ? (
              <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
            ) : (
              <BrandGradient variant="primary" angle={160} style={StyleSheet.absoluteFill} />
            )}
            {/* Darken the bottom so the text reads on any photo */}
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient id={`fade-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0.35" stopColor={c.black} stopOpacity={0} />
                  <Stop offset="0.75" stopColor={c.black} stopOpacity={0.75} />
                  <Stop offset="1" stopColor={c.black} stopOpacity={0.92} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#fade-${item.key})`} />
            </Svg>
            <View className="flex-1 justify-end px-6" style={{ paddingBottom: insets.bottom + 150 }}>
              <View className="border-white/30 bg-white/15 mb-3 self-start rounded-full border px-3 py-1">
                <Text className="text-white text-[10px] font-semibold uppercase tracking-widest">{k(`${item.key}_label`)}</Text>
              </View>
              <Text className="text-white text-[32px] font-bold leading-10">{k(`${item.key}_title`)}</Text>
              <Text className="text-white/80 mt-3 text-sm leading-5">{k(`${item.key}_body`)}</Text>
            </View>
          </View>
        )}
      />

      <View className="absolute inset-x-0 bottom-0 gap-6 px-6" style={{ paddingBottom: insets.bottom + 24 }}>
        <View className="flex-row gap-1.5">
          {SLIDES.map((s, i) => (
            <View key={s.key} className={i === index ? 'bg-white h-1.5 w-6 rounded-full' : 'bg-white/40 h-1.5 w-1.5 rounded-full'} />
          ))}
        </View>
        <Pressable onPress={next} className="bg-white h-14 flex-row items-center justify-center gap-2 rounded-full active:opacity-90" accessibilityRole="button">
          <Text className="text-brand text-base font-semibold">{index >= SLIDES.length - 1 ? k('start') : k('continue')}</Text>
          <Icon flipRtl as={ArrowRight} className="text-brand size-4" />
        </Pressable>
      </View>
    </View>
  );
}
