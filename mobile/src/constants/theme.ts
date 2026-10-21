/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */


import { Platform } from 'react-native';

import { colors } from '@/lib/colors';

/**
 * Colours for the older Expo template components (ThemedText, StatusScreen…), taken from the
 * tokens in src/global.css. Getters read the current value, so light/dark follow the theme.
 */
const palette = () => ({
  text: colors.foreground,
  background: colors.background,
  backgroundElement: colors.muted,
  backgroundSelected: colors.border,
  textSecondary: colors.mutedForeground,
  primary: colors.primary,
  onPrimary: colors.primaryForeground,
  danger: colors.destructive,
});

export const Colors = {
  get light() {
    return palette();
  },
  get dark() {
    return palette();
  },
};

export type ThemeColor = keyof ReturnType<typeof palette>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
