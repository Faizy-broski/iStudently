"use client"

import { useTranslations } from "next-intl"
import { SendDisciplineLog } from "@/components/admin/email/SendDisciplineLog"

export default function DisciplineEmailParentsPage() {
  const t = useTranslations("discipline")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("sendLogToParents")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("emailParentsSubtitle")}
        </p>
      </div>
      <SendDisciplineLog toParents />
    </div>
  )
}
