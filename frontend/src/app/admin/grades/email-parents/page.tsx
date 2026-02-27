"use client"

import { SendReportCards } from "@/components/admin/email/SendReportCards"

export default function GradesEmailParentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Report Cards to Parents</h1>
        <p className="text-muted-foreground mt-1">
          Email personalised report cards to the parents of selected students. Emails are sent to all linked parent accounts.
        </p>
      </div>
      <SendReportCards toParents />
    </div>
  )
}
