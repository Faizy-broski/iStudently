import { useState } from 'react'

/**
 * Run `reset` (e.g. back to page 1) when `key` changes, during render rather than in an effect, so
 * the new filters never render with a stale page first. `reset` may only set this component's state.
 */
export function useResetOn(key: string, reset: () => void) {
  const [prev, setPrev] = useState(key)
  if (prev !== key) {
    setPrev(key)
    reset()
  }
}
