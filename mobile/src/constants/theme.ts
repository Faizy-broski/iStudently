/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */


import { Platform } from 'react-native';

export const Brand = {
  navy: '#022172',
  blue: '#003dd6',
} as const;

export const Colors = {
  light: {
    text: '#0B1220',
    background: '#ffffff',
    backgroundElement: '#F0F2F7',
    backgroundSelected: '#E0E5F0',
    textSecondary: '#5B6475',
    primary: Brand.blue,
    onPrimary: '#ffffff',
    danger: '#C62828',
  },
  dark: {
    text: '#F3F5FA',
    background: '#0A0F1E',
    backgroundElement: '#161C2E',
    backgroundSelected: '#222A40',
    textSecondary: '#A3ABBD',
    primary: '#5B8CFF',
    onPrimary: '#0A0F1E',
    danger: '#EF5350',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
