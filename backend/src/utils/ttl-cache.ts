/**
 * Minimal in-process TTL cache. No external dependency — this process is the
 * only consumer, entries are small (settings objects / booleans), and a
 * short TTL is an explicit, acceptable staleness trade-off (see callers).
 * Not shared across instances — on a multi-instance deployment each
 * instance's cache warms independently, which is fine for this data.
 */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expiresAt: number }>()

  constructor(private ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }
}
