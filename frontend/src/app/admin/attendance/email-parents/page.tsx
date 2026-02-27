"use client"

import { SendDaysAbsent } from "@/components/admin/email/SendDaysAbsent"

export default function AttendanceEmailParentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Days Absent</h1>
        <p className="text-muted-foreground mt-1">
          Notify parents about their child&apos;s absences for a selected date range. Emails are sent to all linked parent accounts.
        </p>
      </div>
      <SendDaysAbsent />
    </div>
  )
}
