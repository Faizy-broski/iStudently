"use client"

import { SendEmailStaff } from "@/components/admin/email/SendEmailStaff"
import { useTranslations } from "next-intl"

export default function EmailStaffPage() {
  const t = useTranslations("email")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("page_staff_title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("page_staff_subtitle")}
        </p>
      </div>
      <SendEmailStaff />
    </div>
  )
}
