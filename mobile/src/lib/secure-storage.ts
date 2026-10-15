import * as SecureStore from 'expo-secure-store'

// Supabase sessions are often larger than SecureStore's ~2 KB per-value limit,
// so values are split across numbered keys. Keys must be [A-Za-z0-9._-].
const CHUNK = 1800

function safeKey(key: string) {
  return key.replace(/[^A-Za-z0-9._-]/g, '_')
}

export const chunkedSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key)
    const count = await SecureStore.getItemAsync(`${k}.n`)
    if (count == null) return null
    const parts = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${k}.${i}`)),
    )
    return parts.some((p) => p == null) ? null : parts.join('')
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key)
    await chunkedSecureStorage.removeItem(key)
    const n = Math.ceil(value.length / CHUNK) || 1
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK))
    }
    await SecureStore.setItemAsync(`${k}.n`, String(n))
  },

  async removeItem(key: string): Promise<void> {
    const k = safeKey(key)
    const count = await SecureStore.getItemAsync(`${k}.n`)
    await SecureStore.deleteItemAsync(`${k}.n`)
    for (let i = 0; i < Number(count ?? 0); i++) {
      await SecureStore.deleteItemAsync(`${k}.${i}`)
    }
  },
}
