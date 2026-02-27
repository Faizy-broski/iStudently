"use client"

import { SendReportCards } from "@/components/admin/email/SendReportCards"

export default function GradesEmailStudentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Report Cards</h1>
        <p className="text-muted-foreground mt-1">
          Email personalised report cards to selected students. Select the marking period and choose which fields to include.
        </p>
      </div>
      <SendReportCards />
    </div>
  )
}
