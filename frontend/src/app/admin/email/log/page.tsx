"use client"

import { EmailLog } from "@/components/admin/email/EmailLog"
import { useTranslations } from "next-intl"

export default function EmailLogPage() {
  const t = useTranslations("email")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("page_log_title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("page_log_subtitle")}
        </p>
      </div>
      <EmailLog />
    </div>
  )
}
