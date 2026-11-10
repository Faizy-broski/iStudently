import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

import { colors } from '@/lib/colors'

/** Navigation chrome colours (headers, tab bar), taken from the tokens in src/global.css. */
export function navTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme
  return {
    ...base,
    // Same font files as the app text (tailwind.config.js): one family per weight.
    fonts: {
      regular: { fontFamily: 'IBMPlexSansArabic_400Regular', fontWeight: 'normal' },
      medium: { fontFamily: 'IBMPlexSansArabic_500Medium', fontWeight: 'normal' },
      bold: { fontFamily: 'IBMPlexSansArabic_600SemiBold', fontWeight: 'normal' },
      heavy: { fontFamily: 'IBMPlexSansArabic_700Bold', fontWeight: 'normal' },
    },
    colors: {
      ...base.colors,
      background: colors.background,
      border: colors.border,
      card: colors.card,
      notification: colors.destructive,
      primary: colors.primary,
      text: colors.foreground,
    },
  }
}
