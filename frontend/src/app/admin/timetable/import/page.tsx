"use client"

import { useTranslations } from "next-intl"
import { TimetableImport } from "@/components/admin/TimetableImport"

export default function TimetableImportPage() {
  const t = useTranslations('school.timetable_import')
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('subtitle')}
        </p>
      </div>
      <TimetableImport />
    </div>
  )
}
