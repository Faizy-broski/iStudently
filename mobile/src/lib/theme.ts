import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'

/** Navigation chrome colours; keep in sync with the CSS variables in src/global.css. */
export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: 'hsl(0, 0%, 100%)',
      border: 'hsl(240, 5.9%, 90%)',
      card: 'hsl(0, 0%, 100%)',
      notification: 'hsl(357, 100%, 45%)',
      primary: 'hsl(223, 100%, 42%)',
      text: 'hsl(240, 11%, 4%)',
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: 'hsl(240, 11%, 4%)',
      border: 'hsl(240, 4%, 18%)',
      card: 'hsl(240, 6%, 10%)',
      notification: 'hsl(359, 100%, 70%)',
      primary: 'hsl(222, 100%, 68%)',
      text: 'hsl(0, 0%, 98%)',
    },
  },
}
