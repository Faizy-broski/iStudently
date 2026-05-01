"use client"

import { SendBalances } from "@/components/admin/email/SendBalances"

export default function FeesEmailParentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">إرسال الأرصدة إلى أولياء الأمور</h1>
        <p className="text-muted-foreground mt-1">
          إرسال كشوف أرصدة مخصصة إلى أولياء أمور الطلاب المحددين. تُرسل الرسائل إلى جميع حسابات أولياء الأمور المرتبطة.
        </p>
      </div>
      <SendBalances toParents />
    </div>
  )
}
