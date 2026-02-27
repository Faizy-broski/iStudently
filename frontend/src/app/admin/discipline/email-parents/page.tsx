"use client"

import { SendDisciplineLog } from "@/components/admin/email/SendDisciplineLog"

export default function DisciplineEmailParentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send Discipline Log to Parents</h1>
        <p className="text-muted-foreground mt-1">
          Email personalised discipline logs to the parents of selected students. Emails are sent to all linked parent accounts.
        </p>
      </div>
      <SendDisciplineLog toParents />
    </div>
  )
}
