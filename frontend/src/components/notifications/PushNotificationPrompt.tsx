"use client"

import { useEffect, useState } from "react"
import { Bell, X } from "lucide-react"
import { toast } from "sonner"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { usePushNotifications } from "@/hooks/usePushNotifications"

const DISMISSED_KEY = "studently_push_prompt_dismissed"

export function PushNotificationPrompt() {
  const t = useTranslations("pushNotifications")
  const { isSupported, status, subscribing, subscribe } = usePushNotifications()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isSupported || status !== "default") return
    if (typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY)) return
    setVisible(true)
  }, [isSupported, status])

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1")
    setVisible(false)
  }

  const handleEnable = async () => {
    const ok = await subscribe()
    if (ok) {
      toast.success(t("enabledSuccess"))
      setVisible(false)
    } else {
      dismiss()
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-6 end-6 z-50 w-80 rounded-xl border bg-white dark:bg-gray-900 shadow-lg p-4">
      <button
        onClick={dismiss}
        className="absolute top-2 end-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        aria-label={t("dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
          <Bell className="h-4 w-4 text-[#022172]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("title")}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("description")}</p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} disabled={subscribing} className="bg-[#022172] hover:bg-[#022172]/90">
              {subscribing ? t("enabling") : t("enable")}
            </Button>
            <Button size="sm" variant="outline" onClick={dismiss}>
              {t("notNow")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
