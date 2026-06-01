"use client"

import { StaffBulkImport } from "@/components/admin/StaffBulkImport"
import { useTranslations } from "next-intl"

export default function StaffBulkImportPage() {
  const t = useTranslations("staff")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("bulkImport.pageTitle")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("bulkImport.pageSubtitle")}
        </p>
      </div>
      <StaffBulkImport />
    </div>
  )
}
