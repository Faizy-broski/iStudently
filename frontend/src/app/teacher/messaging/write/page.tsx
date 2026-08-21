"use client"

import { useTranslations } from "next-intl"
import { MessageCompose } from "@/components/messaging/MessageCompose"

export default function TeacherMessagingWritePage() {
  const t = useTranslations("teacherPages.messagingWrite")
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
      </div>
      <MessageCompose inboxHref="/teacher/messaging" />
    </div>
  )
}
