"use client"

import { SendReportCards } from "@/components/admin/email/SendReportCards"
import { useTranslations } from "next-intl"

export default function GradesEmailParentsPage() {
  const t = useTranslations("school.grades_module.email_parents")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>
      <SendReportCards toParents />
    </div>
  )
}
