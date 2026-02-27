"use client"

import { EmailLog } from "@/components/admin/email/EmailLog"

export default function EmailLogPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Log</h1>
        <p className="text-muted-foreground mt-1">
          View all emails sent from this school. Filter by date range and inspect delivery details.
        </p>
      </div>
      <EmailLog />
    </div>
  )
}
