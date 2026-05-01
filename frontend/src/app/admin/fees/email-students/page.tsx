"use client"

import { SendBalances } from "@/components/admin/email/SendBalances"

export default function FeesEmailStudentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إرسال الأرصدة</h1>
        <p className="text-muted-foreground mt-1">
          إرسال كشوف أرصدة مخصصة للطلاب المحددين. استخدم <code>{"{{balance}}"}</code> و <code>{"{{fees_list}}"}</code> لإدراج تفاصيل الرسوم.
        </p>
      </div>
      <SendBalances />
    </div>
  )
}
