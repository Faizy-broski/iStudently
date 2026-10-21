import Storage from 'expo-sqlite/kv-store'

// The splash screen shows before /auth/me loads, so it uses the last school seen on this device.
const KEY = 'app.last_school_name'

export function getLastSchoolName(): string | null {
  try {
    return Storage.getItemSync(KEY)
  } catch {
    return null
  }
}

export function setLastSchoolName(name: string | null | undefined) {
  try {
    if (name) Storage.setItemSync(KEY, name)
    else Storage.removeItemSync(KEY)
  } catch {}
}
