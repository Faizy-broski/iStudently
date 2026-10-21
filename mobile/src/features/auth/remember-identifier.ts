import Storage from 'expo-sqlite/kv-store'

// "Remember me" keeps only the email / username on this device (never the password).
const KEY = 'auth.remembered_identifier'

export function getRememberedIdentifier(): string {
  try {
    return Storage.getItemSync(KEY) ?? ''
  } catch {
    return ''
  }
}

export function setRememberedIdentifier(identifier: string | null) {
  try {
    if (identifier) Storage.setItemSync(KEY, identifier)
    else Storage.removeItemSync(KEY)
  } catch {}
}
