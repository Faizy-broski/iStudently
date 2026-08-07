"use client"

import { useCallback, useEffect, useState } from "react"
import { getVapidPublicKey, subscribeToPush, unsubscribeFromPush } from "@/lib/api/push-notifications"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export type PushSupportStatus = "unsupported" | "default" | "granted" | "denied"

export function usePushNotifications() {
  const [status, setStatus] = useState<PushSupportStatus>("unsupported")
  const [subscribing, setSubscribing] = useState(false)

  const isSupported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window

  useEffect(() => {
    if (!isSupported) return
    setStatus(Notification.permission as PushSupportStatus)
  }, [isSupported])

  const subscribe = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    if (!isSupported) return { success: false, reason: "Push notifications are not supported in this browser" }

    setSubscribing(true)
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission as PushSupportStatus)
      if (permission !== "granted") return { success: false, reason: "Notification permission denied" }

      const publicKey = await getVapidPublicKey()
      if (!publicKey) return { success: false, reason: "Push notifications are not configured on the server (missing VAPID key)" }

      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        })
      }

      const result = await subscribeToPush(subscription.toJSON() as PushSubscriptionJSON)
      return result.success ? { success: true } : { success: false, reason: result.error || "Failed to save subscription" }
    } catch (err) {
      console.error("Push subscription failed:", err)
      return { success: false, reason: err instanceof Error ? err.message : String(err) }
    } finally {
      setSubscribing(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!isSupported) return
    const registration = await navigator.serviceWorker.getRegistration("/sw.js")
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return

    await unsubscribeFromPush(subscription.endpoint)
    await subscription.unsubscribe()
  }, [isSupported])

  return { isSupported, status, subscribing, subscribe, unsubscribe }
}
