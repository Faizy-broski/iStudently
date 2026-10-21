import { isExpoPushToken, sendExpoPush } from './expo-push.service'

const T = (n: number) => `ExponentPushToken[t${n}]`

describe('sendExpoPush', () => {
  it('sends valid tokens in chunks of 100 and reports unregistered devices', async () => {
    const bodies: any[][] = []
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const batch = JSON.parse(String(init.body))
      bodies.push(batch)
      return { ok: true, json: async () => ({ data: batch.map((m: any) => (m.to === T(3) ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }) }
    }) as unknown as typeof fetch
    const tokens = [...Array.from({ length: 150 }, (_, i) => T(i)), 'not-a-token', T(1)]
    const dead = await sendExpoPush(tokens, { title: 'Hi', body: 'There', url: '/parent/homework' }, fetchImpl)
    expect(bodies.map((b) => b.length)).toEqual([100, 50])
    expect(bodies[0][0]).toMatchObject({ to: T(0), title: 'Hi', body: 'There', data: { url: '/parent/homework' } })
    expect(dead).toEqual([T(3)])
  })
  it('never throws when the push service is unreachable', async () => {
    const fetchImpl = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    await expect(sendExpoPush([T(1)], { title: 'a', body: 'b' }, fetchImpl)).resolves.toEqual([])
  })
  it('recognises Expo push tokens only', () => {
    expect(isExpoPushToken(T(1))).toBe(true)
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true)
    expect(isExpoPushToken('abc')).toBe(false)
  })
})
