"use client"

import { EmailNotifications } from "@/components/admin/email/EmailNotifications"
import { useTranslations } from "next-intl"

export default function EmailNotificationsPage() {
  const t = useTranslations("email")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("page_notifications_title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("page_notifications_subtitle")}
        </p>
      </div>
      <EmailNotifications />
    </div>
  )
}
