import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import LogoShape from '@/assets/images/Vector.svg';
import { useColors } from '@/lib/colors';

const SHAPE_RATIO = 899 / 611; // Vector.svg height / width

/**
 * Background for sign-in, forgot / reset / change password and 2FA screens (Figma):
 * the app background with the large logo shape faded behind the content.
 */
export function AuthBackground({ children }: { children: ReactNode }) {
  const c = useColors();
  const { width, height } = useWindowDimensions();
  const w = width * 1.35;
  return (
    <View className="bg-background flex-1">
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
        <View style={{ position: 'absolute', left: width * 0.05, top: height * 0.08, opacity: 0.08 }}>
          <LogoShape width={w} height={w * SHAPE_RATIO} color={c.brandSecondary} />
        </View>
      </View>
      {children}
    </View>
  );
}
