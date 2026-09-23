"use client"

import { useEffect } from "react"

/**
 * Registers the root service worker (public/sw.js) unconditionally on every page load, so
 * the app is installable (Add to Home Screen / desktop install) for every visitor — not just
 * those who opted into push notifications, which was the only place /sw.js got registered
 * before. Safe to call alongside usePushNotifications' own register('/sw.js') call: the
 * browser dedupes registrations for the same scope/script, it's a cheap no-op update check.
 */
export function PwaServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err)
    })
  }, [])

  return null
}
