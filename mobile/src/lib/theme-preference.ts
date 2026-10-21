import Storage from 'expo-sqlite/kv-store'
import { colorScheme } from 'nativewind'

export type ThemePreference = 'light' | 'dark' | 'system'

const KEY = 'app.theme'

/** Light by default; dark or "follow the phone" only when the user picks it in Settings. */
export function getThemePreference(): ThemePreference {
  const saved = Storage.getItemSync(KEY)
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'light'
}

export function setThemePreference(pref: ThemePreference) {
  Storage.setItemSync(KEY, pref)
  colorScheme.set(pref)
}

/** Apply the saved choice at startup (before first render). */
export function applySavedThemePreference() {
  colorScheme.set(getThemePreference())
}
