"use client"

import { SendBalances } from "@/components/admin/email/SendBalances"
import { useTranslations } from "next-intl"

export default function FeesEmailParentsPage() {
  const t = useTranslations('fees.emailParents')
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>
      <SendBalances toParents />
    </div>
  )
}

