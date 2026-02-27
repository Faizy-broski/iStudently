"use client"

import { SendEmailStudents } from "@/components/admin/email/SendEmailStudents"

export default function EmailStudentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Email to Students</h1>
        <p className="text-muted-foreground mt-1">
          Compose and send personalised emails to selected students. Use substitution variables to personalise each message.
        </p>
      </div>
      <SendEmailStudents />
    </div>
  )
}
