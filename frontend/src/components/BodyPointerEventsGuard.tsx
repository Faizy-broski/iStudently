'use client'

import { useEffect } from 'react'

/**
 * Radix UI (Dialog/AlertDialog/Sheet/Select/DropdownMenu — all used heavily
 * throughout this app, often nested, e.g. a Select inside a Dialog) locks
 * `document.body.style.pointer-events = 'none'` while any of those are open,
 * and restores it when the last one closes. If one is unmounted abnormally —
 * a client-side route change while it's still open, a nested overlay closing
 * out of order, a fast double-interaction — that restore can be skipped,
 * leaving the whole app (sidebar included) permanently unclickable until a
 * hard refresh, with no visible error.
 *
 * This watches for exactly that stuck state — `pointer-events: none` on
 * `<body>` while no Radix overlay is actually open (all Radix overlay
 * content/overlays carry `data-state="open"` while visible) — and clears it.
 */
export function BodyPointerEventsGuard() {
  useEffect(() => {
    const clearIfStuck = () => {
      if (document.body.style.pointerEvents !== 'none') return
      const hasOpenOverlay = document.querySelector('[data-state="open"]') !== null
      if (!hasOpenOverlay) {
        document.body.style.pointerEvents = ''
      }
    }

    // Radix flips the style synchronously; a Dialog's own unmount/close cleanup
    // runs in the same tick, so a microtask/short delay avoids racing it.
    // This alone only re-checks when body's style attribute mutates again —
    // the actual stuck case is exactly when it DOESN'T (the close cleanup that
    // should have removed the lock never ran), so nothing would ever trigger
    // a re-check. A cheap interval closes that gap: it's what actually
    // recovers the stuck state, typically within ~1s of it happening — the
    // observer just makes the common (non-stuck) case react instantly instead
    // of waiting out the interval.
    const observer = new MutationObserver(() => {
      setTimeout(clearIfStuck, 50)
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })
    const interval = setInterval(clearIfStuck, 1000)

    return () => {
      observer.disconnect()
      clearInterval(interval)
    }
  }, [])

  return null
}
