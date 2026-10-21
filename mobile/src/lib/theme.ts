import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

import { colors } from '@/lib/colors'

/** Navigation chrome colours (headers, tab bar), taken from the tokens in src/global.css. */
export function navTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme
  return {
    ...base,
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
