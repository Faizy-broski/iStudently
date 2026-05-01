"use client"

import { SendEmailStaff } from "@/components/admin/email/SendEmailStaff"

export default function EmailStaffPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Email to Staff</h1>
        <p className="text-muted-foreground mt-1">
          Compose and send personalised emails to teachers, librarians, counselors, and other staff members.
        </p>
      </div>
      <SendEmailStaff />
    </div>
  )
}
