import { useId } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useColors } from '@/lib/colors';

/**
 * The two brand gradients from src/global.css, drawn behind `children`:
 * - `primary` (linear-gradient-1): gradient-1-start 0% → gradient-1-mid 56% → gradient-1-end 100%
 * - `gold` (radial gradient): gradient-2-start 0% → gradient-2-end 100%
 */
export function BrandGradient({ variant = 'primary', angle = 135, style, children, ...props }: ViewProps & { variant?: 'primary' | 'gold'; angle?: number }) {
  const c = useColors();
  const id = `g${useId().replace(/:/g, '')}`;
  // Angle like CSS linear-gradient (135deg = top-left → bottom-right).
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return (
    <View style={[{ overflow: 'hidden' }, style]} {...props}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {variant === 'gold' ? (
            <RadialGradient id={id} cx="50%" cy="50%" r="75%">
              <Stop offset="0" stopColor={c.gradient2Start} />
              <Stop offset="1" stopColor={c.gradient2End} />
            </RadialGradient>
          ) : (
            <LinearGradient id={id} x1={0.5 - x} y1={0.5 - y} x2={0.5 + x} y2={0.5 + y}>
              <Stop offset="0" stopColor={c.gradient1Start} />
              <Stop offset="0.56" stopColor={c.gradient1Mid} />
              <Stop offset="1" stopColor={c.gradient1End} />
            </LinearGradient>
          )}
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}
