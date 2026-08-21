"use client"

import { useTranslations } from "next-intl"
import { MessagingInbox } from "@/components/messaging/MessagingInbox"

export default function TeacherMessagingPage() {
  const t = useTranslations("teacherPages.messaging")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <MessagingInbox writeHref="/teacher/messaging/write" />
    </div>
  )
}
