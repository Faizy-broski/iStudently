"use client"

import { SendEmailStudents } from "@/components/admin/email/SendEmailStudents"
import { useTranslations } from "next-intl"

export default function EmailStudentsPage() {
  const t = useTranslations("school.students.send_email")
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#022172] dark:text-white">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>
      <SendEmailStudents />
    </div>
  )
}
