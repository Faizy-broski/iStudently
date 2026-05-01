"use client"

import { EmailNotifications } from "@/components/admin/email/EmailNotifications"

export default function EmailNotificationsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Notifications</h1>
        <p className="text-muted-foreground mt-1">
          Configure automated email notifications for absences, birthdays, and payment reminders.
        </p>
      </div>
      <EmailNotifications />
    </div>
  )
}
