"use client"

import { StudentBulkImport } from "@/components/admin/StudentBulkImport"
import { useTranslations } from "next-intl"

export default function StudentBulkImportPage() {
  const t = useTranslations("school.students.bulk_import")

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>
      <StudentBulkImport />
    </div>
  )
}
