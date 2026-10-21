// Phone push through Expo's push service (https://docs.expo.dev/push-notifications/sending-notifications/).
// EXPO_ACCESS_TOKEN is optional (needed only when "enhanced push security" is on for the Expo project).

const ENDPOINT = 'https://exp.host/--/api/v2/push/send'
const CHUNK = 100

export interface ExpoPushMessage {
  title: string
  body: string
  /** Web path of the related page; the app opens the matching screen when the notification is tapped. */
  url?: string
}

export const isExpoPushToken = (t: unknown): t is string => typeof t === 'string' && /^Expo(nent)?PushToken\[[^\]]+\]$/.test(t)

/**
 * Sends one message to every token. Returns the tokens Expo reports as no longer registered
 * (app uninstalled / token rotated) so the caller can deactivate them. Never throws.
 */
export async function sendExpoPush(tokens: string[], msg: ExpoPushMessage, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const valid = [...new Set(tokens.filter(isExpoPushToken))]
  const dead: string[] = []
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`
  for (let i = 0; i < valid.length; i += CHUNK) {
    const batch = valid.slice(i, i + CHUNK)
    try {
      const res = await fetchImpl(ENDPOINT, {
        method: 'POST',
        headers,
        body: JSON.stringify(batch.map((to) => ({ to, title: msg.title, body: msg.body, sound: 'default', data: msg.url ? { url: msg.url } : {} }))),
      })
      const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null
      json?.data?.forEach((ticket, j) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(batch[j])
      })
      if (!res.ok) console.error(`[push] Expo push failed: HTTP ${res.status}`)
    } catch (err) {
      console.error('[push] Expo push request failed:', err)
    }
  }
  return dead
}
