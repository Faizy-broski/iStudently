import Storage from 'expo-sqlite/kv-store'

// The intro slides show once per install, before the first sign-in.
const KEY = 'app.onboarding_seen'

export function hasSeenOnboarding(): boolean {
  try {
    return Storage.getItemSync(KEY) === '1'
  } catch {
    return true
  }
}

export function markOnboardingSeen() {
  try {
    Storage.setItemSync(KEY, '1')
  } catch {}
}
